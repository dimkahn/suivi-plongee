import { Component, DestroyRef, ElementRef, computed, inject, signal, viewChild, ChangeDetectionStrategy } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { HttpErrorResponse } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { ApiService } from '../../core/api.service';
import { AccesIaVue, EtatIaVue, LigneJournalIaVue, LivraisonIaVue, SessionIaVue, TypeJournalIa } from '../../core/modeles';

/** Limites des pièces jointes, les mêmes que le serveur (AssistantIaService). */
const PIECES_MAX = 10;
const TAILLE_MAX_PIECE = 20 * 1024 * 1024;

/** Lignes du journal qui terminent un travail : on relit alors l'état de la livraison. */
const FINS_DE_TRAVAIL: TypeJournalIa[] = ['FIN', 'ERREUR', 'ARRET', 'TESTS_OK', 'TESTS_KO'];
const EVENEMENTS: Partial<Record<TypeJournalIa, string>> = {
  TESTS_LANCES: 'Tests lancés', TESTS_OK: 'Tests verts', TESTS_KO: 'Tests en échec',
  MERGE: 'Merge sur master', TAG_POUSSE: 'Tag poussé', ARRET: 'Interrompu', ERREUR: 'Erreur'
};

/**
 * Assistant IA : discuter avec Claude Code, qui tourne sur le poste de
 * développement, pour faire évoluer l'application. L'assistant travaille
 * sur sa branche ; les tests, le merge sur master et le tag (mise en
 * production) sont des boutons confirmés ici, jamais des gestes de
 * l'assistant. Le serveur refuse le merge et le tag sans mvn test vert
 * sur le commit exact.
 */
@Component({
  selector: 'app-assistant-ia',
  imports: [FormsModule],
  template: `
    <h1>Assistant IA</h1>

    @if (indisponible()) {
      <div class="carte vide">
        <p>L'assistant IA n'est pas activé sur ce serveur (réglage IA_ACTIVE).</p>
      </div>
    } @else if (!acces()) {
      <p class="vide">Chargement…</p>
    } @else if (!acces()!.ouvert) {
      <section class="carte verrou">
        <h2>Accès protégé</h2>
        <p>
          L'assistant peut modifier le code et le mettre en production : il faut un code à usage unique,
          envoyé à <strong>{{ acces()!.destinataire }}</strong>. Il vaut une heure, et l'accès se referme
          au bout de cette heure.
        </p>
        @if (message(); as m) { <div class="alerte" role="status">{{ m }}</div> }
        @if (acces()!.codeEnvoye) {
          <form (ngSubmit)="validerCode()">
            <label for="code">Code reçu par courriel</label>
            <input id="code" name="code" [(ngModel)]="code" autocomplete="one-time-code"
                   autocapitalize="characters" spellcheck="false" maxlength="12" placeholder="Ex. K7PX2MQA">
            <div class="actions">
              <button type="button" class="bouton-discret" (click)="demanderCode()" [disabled]="envoi()">
                Renvoyer un code
              </button>
              <button type="submit" class="bouton-principal" [disabled]="!code.trim() || envoi()">Ouvrir</button>
            </div>
          </form>
        } @else {
          <div class="actions">
            <button type="button" class="bouton-principal" (click)="demanderCode()" [disabled]="envoi()">
              {{ envoi() ? 'Envoi…' : 'Recevoir un code' }}
            </button>
          </div>
        }
      </section>
    } @else {
      <p class="secondaire">
        Accès ouvert jusqu'à {{ heure(acces()!.ouvertJusquA) }}.
        <button type="button" class="lien" (click)="fermerAcces()">Refermer maintenant</button>
      </p>
      <p class="secondaire">
        Claude Code travaille sur une copie du code, dans sa propre branche. Rien n'atteint master ni la
        production sans vos clics : tests, merge, puis tag.
        @if (etat(); as e) {
          <br>Dépôt {{ e.depot }}, sur la branche {{ e.brancheCourante ?? '(détachée)' }}.
        }
      </p>

      @if (message(); as m) { <div class="alerte" role="status">{{ m }}</div> }

      <div class="disposition">
        <aside class="carte sessions">
          <h2>Sessions</h2>
          <form (ngSubmit)="creer()">
            <label for="titre">Nouvelle session</label>
            <input id="titre" name="titre" [(ngModel)]="titre" maxlength="120"
                   placeholder="Ex. : export CSV des présences">
            <button type="submit" class="bouton-principal" [disabled]="envoi() || !titre.trim()">
              {{ envoi() ? 'Création…' : 'Commencer' }}
            </button>
          </form>
          <ul>
            @for (s of sessions(); track s.id) {
              <li>
                <button type="button" class="bouton-discret session" [class.actif]="s.id === choisie()?.id"
                        (click)="choisir(s)">
                  <span class="nom">{{ s.titre }}</span>
                  <span class="secondaire">{{ s.branche }} · {{ s.creePar }}</span>
                </button>
              </li>
            } @empty {
              <li class="secondaire">Aucune session pour l'instant.</li>
            }
          </ul>
        </aside>

        @if (choisie(); as s) {
          <section class="conversation carte">
            <h2>{{ s.titre }}</h2>
            <div class="fil" #fil aria-live="polite">
              @for (l of lignes(); track l.id) {
                @switch (l.type) {
                  @case ('MESSAGE') {
                    <div class="bulle moi"><span class="qui">{{ l.auteur }}</span>{{ l.contenu }}</div>
                  }
                  @case ('TEXTE') {
                    <div class="bulle assistant">{{ l.contenu }}</div>
                  }
                  @case ('OUTIL') {
                    <div class="outil">› {{ l.contenu }}</div>
                  }
                  @case ('OUTIL_ERREUR') {
                    <details class="outil erreur"><summary>› refusé ou en échec</summary><pre>{{ l.contenu }}</pre></details>
                  }
                  @case ('FIN') {
                    <div class="fin secondaire">{{ l.contenu }}</div>
                  }
                  @default {
                    <div class="evenement" [class.ok]="l.type === 'TESTS_OK' || l.type === 'MERGE' || l.type === 'TAG_POUSSE'"
                         [class.ko]="l.type === 'TESTS_KO' || l.type === 'ERREUR'">
                      <strong>{{ libelle(l.type) }}</strong>
                      @if (l.auteur) { <span class="secondaire"> · {{ l.auteur }}</span> }
                      @if (l.type === 'TESTS_KO') {
                        <details><summary>Détail</summary><pre>{{ l.contenu }}</pre></details>
                      } @else {
                        <div class="texte">{{ l.contenu }}</div>
                      }
                    </div>
                  }
                }
              } @empty {
                <p class="secondaire">Décrivez ce que vous voulez : une fonctionnalité, une correction, une question sur le code.</p>
              }
              @if (travail() === 'assistant') { <p class="secondaire attente">L'assistant travaille…</p> }
              @if (travail() === 'tests') { <p class="secondaire attente">Les tests tournent (plusieurs minutes)…</p> }
            </div>

            <form class="saisie" (ngSubmit)="envoyer()" [class.survol]="survol()"
                  (dragover)="survolDepot($event)" (dragleave)="survol.set(false)" (drop)="deposer($event)">
              <label for="texte" class="visuellement-cache">Message à l'assistant</label>
              <textarea id="texte" name="texte" rows="3" [(ngModel)]="texte" [disabled]="!!travail()"
                        (keydown.control.enter)="envoyer()" (paste)="coller($event)"
                        placeholder="Votre demande (Ctrl+Entrée pour envoyer). Glissez ou collez des fichiers ici."></textarea>
              @if (pieces().length) {
                <ul class="pieces" aria-label="Pièces jointes">
                  @for (f of pieces(); track $index) {
                    <li>
                      <span class="nom-piece">{{ f.name }}</span>
                      <span class="secondaire">{{ taille(f.size) }}</span>
                      <button type="button" class="bouton-discret retirer" (click)="retirerPiece($index)"
                              [attr.aria-label]="'Retirer ' + f.name">✕</button>
                    </li>
                  }
                </ul>
              }
              <div class="actions">
                <label class="bouton-discret joindre" [class.inactif]="!!travail()">
                  Joindre des fichiers
                  <input type="file" multiple hidden [disabled]="!!travail()" (change)="choisirPieces($event)">
                </label>
                @if (travail()) {
                  <button type="button" class="bouton-discret danger" (click)="arreter()">Interrompre</button>
                } @else {
                  <button type="submit" class="bouton-principal"
                          [disabled]="(!texte.trim() && !pieces().length) || envoi()">
                    {{ envoi() ? 'Envoi…' : 'Envoyer' }}
                  </button>
                }
              </div>
            </form>
          </section>

          <section class="carte livraison">
            <h2>Livraison</h2>
            @if (livraison(); as l) {
              <p class="secondaire">Branche {{ l.branche }} · {{ l.commits.length }} commit(s) hors de master</p>
              <ul class="controles">
                <li [class.ok]="l.copiePropre">{{ l.copiePropre ? '✓' : '✗' }} Tout est commité</li>
                <li [class.ok]="l.brancheTestee">{{ l.brancheTestee ? '✓' : '✗' }} Tests verts sur le dernier commit</li>
                <li [class.ok]="l.dansMaster">{{ l.dansMaster ? '✓' : '✗' }} Dans master</li>
                <li [class.ok]="l.masterTeste">{{ l.masterTeste ? '✓' : '✗' }} master testé, prêt à tagger</li>
              </ul>
              @if (l.commits.length) {
                <details>
                  <summary>Ce qui a changé</summary>
                  <ul class="commits">@for (c of l.commits; track c) { <li>{{ c }}</li> }</ul>
                  <pre>{{ l.resumeModifications }}</pre>
                </details>
              }

              <div class="etapes">
                <button type="button" class="bouton-discret" (click)="lancerTests()"
                        [disabled]="!!travail() || !l.copiePropre || envoi()">
                  1. Lancer les tests (mvn test)
                </button>

                @if (confirmation() === 'merge') {
                  <div class="confirmation">
                    <p>Merger <strong>{{ l.branche }}</strong> sur master ({{ l.commits.length }} commit(s)) ?
                      Rien ne part sur GitHub à cette étape.</p>
                    <div class="actions">
                      <button type="button" class="bouton-principal" (click)="merger()" [disabled]="envoi()">Confirmer le merge</button>
                      <button type="button" class="bouton-discret" (click)="confirmation.set(null)">Annuler</button>
                    </div>
                  </div>
                } @else {
                  <button type="button" class="bouton-discret" (click)="confirmation.set('merge')"
                          [disabled]="!!travail() || !l.brancheTestee || l.dansMaster">
                    2. Merger sur master
                  </button>
                }

                @if (confirmation() === 'tag') {
                  <div class="confirmation">
                    <label for="tag">Tag</label>
                    <input id="tag" name="tag" [(ngModel)]="tag">
                    <p><strong>Mise en production.</strong> master et {{ tag }} partent sur GitHub ; le serveur du club
                      déploie ce tag dans les 5 minutes (et revient en arrière seul si le backend ne répond pas).</p>
                    <div class="actions">
                      <button type="button" class="bouton-principal" (click)="tagger()" [disabled]="envoi() || !tag.trim()">
                        {{ envoi() ? 'Envoi…' : 'Confirmer : tagger et pousser' }}
                      </button>
                      <button type="button" class="bouton-discret" (click)="confirmation.set(null)">Annuler</button>
                    </div>
                  </div>
                } @else {
                  <button type="button" class="bouton-discret" (click)="ouvrirTag(l)"
                          [disabled]="!!travail() || !l.masterTeste">
                    3. Créer le tag et pousser
                  </button>
                }
              </div>
            } @else {
              <p class="secondaire">Chargement…</p>
            }
          </section>
        } @else {
          <div class="carte vide conversation"><p>Choisissez une session ou commencez-en une.</p></div>
        }
      </div>
    }
  `,
  styles: [`
    .verrou { max-width: 560px; padding: var(--pas-3); margin-top: var(--pas-2); }
    .verrou input { font-family: ui-monospace, monospace; letter-spacing: .15em; text-transform: uppercase; }
    .verrou .actions { justify-content: flex-start; }
    .lien { background: none; border: none; padding: 0 4px; min-height: 44px; color: var(--profond);
            text-decoration: underline; cursor: pointer; font: inherit; }
    .disposition { display: grid; grid-template-columns: 260px 1fr 300px; gap: var(--pas-2); align-items: start;
                   margin-top: var(--pas-2); }
    .carte { padding: var(--pas-2); }
    h2 { margin-bottom: var(--pas); }
    label { display: block; margin: var(--pas) 0; font-weight: 700; font-size: .9375rem; }
    .sessions form .bouton-principal { width: 100%; margin-top: var(--pas); }
    .sessions ul { list-style: none; margin: var(--pas-2) 0 0; padding: 0; display: grid; gap: var(--pas); }
    .session { width: 100%; text-align: left; display: flex; flex-direction: column; gap: 2px; }
    .session .nom { font-weight: 700; }
    .session .secondaire { overflow-wrap: anywhere; }
    .session.actif { border-color: var(--profond); box-shadow: inset 3px 0 0 var(--profond); }

    .conversation { display: flex; flex-direction: column; min-height: 60vh; }
    .fil { flex: 1; overflow-y: auto; max-height: 65vh; display: flex; flex-direction: column; gap: var(--pas);
           padding: var(--pas) 0; }
    .bulle { white-space: pre-wrap; overflow-wrap: anywhere; padding: 10px 14px; border-radius: var(--r); max-width: 90%; }
    .bulle.moi { align-self: flex-end; background: var(--profond); color: #fff; }
    .bulle.moi .qui { display: block; font-size: .75rem; opacity: .8; }
    .bulle.assistant { align-self: flex-start; background: var(--fond); border: 1px solid var(--trait); }
    .outil { font-family: ui-monospace, monospace; font-size: .8125rem; color: var(--craie); overflow-wrap: anywhere; }
    .outil.erreur summary { color: #B91C1C; cursor: pointer; }
    .fin { text-align: center; font-size: .75rem; }
    .evenement { border-left: 4px solid var(--trait); padding: var(--pas) var(--pas-2); background: var(--fond);
                 border-radius: var(--r-s); }
    .evenement.ok { border-color: var(--acquis); background: var(--acquis-clair); }
    .evenement.ko { border-color: #B91C1C; background: #FEF2F2; }
    .evenement .texte { white-space: pre-wrap; overflow-wrap: anywhere; font-size: .875rem; }
    pre { white-space: pre-wrap; overflow-wrap: anywhere; font-size: .75rem; max-height: 320px; overflow-y: auto; }
    .attente { font-style: italic; }
    .saisie { border-top: 1px solid var(--trait); padding-top: var(--pas); }
    textarea { resize: vertical; }
    .actions { display: flex; gap: var(--pas); flex-wrap: wrap; justify-content: flex-end; margin-top: var(--pas); }
    .danger { color: #B91C1C; border-color: #FCA5A5; }
    .saisie.survol { outline: 2px dashed var(--profond); outline-offset: 4px; border-radius: var(--r-s); }
    .pieces { list-style: none; margin: var(--pas) 0 0; padding: 0; display: flex; flex-wrap: wrap; gap: var(--pas); }
    .pieces li { display: flex; align-items: center; gap: 6px; padding-left: 12px; border: 1px solid var(--trait);
                 border-radius: var(--r-s); background: var(--fond); max-width: 100%; }
    .nom-piece { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; max-width: 200px; }
    .retirer { min-width: 44px; border: none; background: none; }
    .joindre { display: inline-flex; align-items: center; cursor: pointer; margin: 0 auto 0 0; font-weight: 400;
               border: 1px solid var(--trait); border-radius: var(--r-s); }
    .joindre.inactif { opacity: .5; cursor: not-allowed; }

    .controles { list-style: none; margin: var(--pas) 0; padding: 0; display: grid; gap: 4px; color: #B91C1C; }
    .controles .ok { color: var(--acquis); }
    .commits { padding-left: 1.25rem; font-size: .8125rem; }
    details summary { cursor: pointer; min-height: 44px; display: flex; align-items: center; font-weight: 700; }
    .etapes { display: grid; gap: var(--pas); margin-top: var(--pas-2); }
    .etapes > .bouton-discret { text-align: left; }
    .confirmation { border: 2px solid var(--accent); border-radius: var(--r-s); padding: var(--pas-2); }
    .confirmation .actions { justify-content: flex-start; }
    .visuellement-cache { position: absolute; width: 1px; height: 1px; overflow: hidden; clip: rect(0 0 0 0); }

    @media (max-width: 1100px) {
      .disposition { grid-template-columns: 1fr; }
      .fil { max-height: 55vh; }
    }
  `],
  changeDetection: ChangeDetectionStrategy.Eager,
})
export class AssistantIaComponent {
  private api = inject(ApiService);
  private destroyRef = inject(DestroyRef);
  private fil = viewChild<ElementRef<HTMLElement>>('fil');

  etat = signal<EtatIaVue | null>(null);
  /** Verrou par code envoyé par courriel ; null tant qu'il n'est pas lu. */
  acces = signal<AccesIaVue | null>(null);
  code = '';
  indisponible = signal(false);
  sessions = signal<SessionIaVue[]>([]);
  choisie = signal<SessionIaVue | null>(null);
  lignes = signal<LigneJournalIaVue[]>([]);
  livraison = signal<LivraisonIaVue | null>(null);
  /** 'assistant' ou 'tests' pendant un travail, suivi par le journal. */
  travail = signal<string | null>(null);
  confirmation = signal<'merge' | 'tag' | null>(null);
  message = signal<string | null>(null);
  envoi = signal(false);

  private derniere = computed(() => this.lignes().at(-1)?.id ?? 0);
  private lectureEnCours = false;

  titre = '';
  texte = '';
  /** Fichiers joints au prochain message (captures d'écran, documents). */
  pieces = signal<File[]>([]);
  survol = signal(false);
  tag = '';

  constructor() {
    void this.demarrer();
    const intervalle = setInterval(() => void this.suivre(), 1_500);
    this.destroyRef.onDestroy(() => clearInterval(intervalle));
  }

  libelle(type: TypeJournalIa): string {
    return EVENEMENTS[type] ?? type;
  }

  private async demarrer(): Promise<void> {
    try {
      this.acces.set(await firstValueFrom(this.api.accesIa()));
    } catch {
      // Adresses absentes (serveur sans assistant) ou rôles manquants.
      this.indisponible.set(true);
      return;
    }
    if (!this.acces()!.ouvert) return;
    try {
      this.etat.set(await firstValueFrom(this.api.etatIa()));
      this.sessions.set(await firstValueFrom(this.api.sessionsIa()));
    } catch (e) {
      this.erreur(e, "L'assistant n'a pas pu être chargé.");
    }
  }

  async demanderCode(): Promise<void> {
    this.envoi.set(true);
    this.message.set(null);
    try {
      this.acces.set(await firstValueFrom(this.api.demanderCodeIa()));
      this.code = '';
      this.message.set(`Code envoyé à ${this.acces()!.destinataire}.`);
    } catch (e) {
      this.erreur(e, "Le code n'a pas pu être envoyé.");
    } finally {
      this.envoi.set(false);
    }
  }

  async validerCode(): Promise<void> {
    if (!this.code.trim()) return;
    this.envoi.set(true);
    this.message.set(null);
    try {
      this.acces.set(await firstValueFrom(this.api.validerCodeIa(this.code.trim())));
      this.code = '';
      void this.demarrer();
    } catch (e) {
      this.erreur(e, "Le code n'a pas pu être vérifié.");
      // Code annulé après trop d'erreurs : l'écran revient à « Recevoir un code ».
      this.acces.set(await firstValueFrom(this.api.accesIa()).catch(() => this.acces()));
    } finally {
      this.envoi.set(false);
    }
  }

  async fermerAcces(): Promise<void> {
    try {
      await firstValueFrom(this.api.fermerAccesIa());
    } catch {
      // déjà refermé côté serveur : on relit l'état ci-dessous
    }
    this.fermerLocalement();
    this.acces.set(await firstValueFrom(this.api.accesIa()).catch(() => null));
  }

  private fermerLocalement(): void {
    this.choisie.set(null);
    this.sessions.set([]);
    this.lignes.set([]);
    this.livraison.set(null);
    this.pieces.set([]);
  }

  heure(iso: string | null): string {
    return iso ? new Date(iso).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }) : '';
  }

  /** Une réponse 403 en cours d'usage : l'heure est passée, on revient à l'écran du code. */
  private async verifierAcces(): Promise<void> {
    try {
      const a = await firstValueFrom(this.api.accesIa());
      if (!a.ouvert) {
        this.fermerLocalement();
        this.message.set("L'heure d'accès est écoulée : demandez un nouveau code.");
      }
      this.acces.set(a);
    } catch {
      // réseau : sans conséquence, le prochain appel réessaiera
    }
  }

  async creer(): Promise<void> {
    if (!this.titre.trim()) return;
    this.envoi.set(true);
    this.message.set(null);
    try {
      const s = await firstValueFrom(this.api.creerSessionIa(this.titre.trim()));
      this.titre = '';
      this.sessions.set([s, ...this.sessions()]);
      this.choisir(s);
    } catch (e) {
      this.erreur(e, "La session n'a pas pu être créée.");
    } finally {
      this.envoi.set(false);
    }
  }

  choisir(s: SessionIaVue): void {
    this.choisie.set(s);
    this.lignes.set([]);
    this.pieces.set([]);
    this.livraison.set(null);
    this.confirmation.set(null);
    this.message.set(null);
    this.travail.set(s.travailEnCours);
    void this.suivre();
    void this.relireLivraison();
  }

  async envoyer(): Promise<void> {
    const s = this.choisie();
    const texte = this.texte.trim();
    const pieces = this.pieces();
    if (!s || (!texte && !pieces.length) || this.travail() || this.envoi()) return;
    this.envoi.set(true);
    this.message.set(null);
    try {
      await firstValueFrom(this.api.envoyerMessageIa(s.id, texte, pieces));
      this.texte = '';
      this.pieces.set([]);
      this.travail.set('assistant');
      void this.suivre();
    } catch (e) {
      this.erreur(e, "Le message n'a pas pu être envoyé.");
    } finally {
      this.envoi.set(false);
    }
  }

  choisirPieces(evenement: Event): void {
    const entree = evenement.target as HTMLInputElement;
    this.ajouterPieces([...(entree.files ?? [])]);
    entree.value = '';
  }

  survolDepot(evenement: DragEvent): void {
    if (this.travail() || !evenement.dataTransfer?.types.includes('Files')) return;
    evenement.preventDefault();
    this.survol.set(true);
  }

  deposer(evenement: DragEvent): void {
    this.survol.set(false);
    if (this.travail() || !evenement.dataTransfer?.files.length) return;
    evenement.preventDefault();
    this.ajouterPieces([...evenement.dataTransfer.files]);
  }

  /** Une capture d'écran collée (Ctrl+V) devient une pièce jointe ; du texte collé reste du texte. */
  coller(evenement: ClipboardEvent): void {
    const fichiers = [...(evenement.clipboardData?.files ?? [])];
    if (!fichiers.length) return;
    evenement.preventDefault();
    const horodatage = new Date().toISOString().slice(11, 19).replaceAll(':', '');
    this.ajouterPieces(fichiers.map((f, i) => f.name && f.name !== 'image.png'
      ? f : new File([f], `capture-${horodatage}${i ? '-' + (i + 1) : ''}.png`, { type: f.type })));
  }

  retirerPiece(index: number): void {
    this.pieces.set(this.pieces().filter((_, i) => i !== index));
  }

  /** Mêmes limites que le serveur, pour prévenir avant l'envoi. */
  private ajouterPieces(fichiers: File[]): void {
    const tropGros = fichiers.filter(f => f.size > TAILLE_MAX_PIECE);
    const vides = fichiers.filter(f => f.size === 0);
    const retenus = [...this.pieces(), ...fichiers.filter(f => f.size > 0 && f.size <= TAILLE_MAX_PIECE)];
    this.pieces.set(retenus.slice(0, PIECES_MAX));
    const problemes = [
      ...tropGros.map(f => `« ${f.name} » dépasse 20 Mo`),
      ...vides.map(f => `« ${f.name} » est vide`),
      ...(retenus.length > PIECES_MAX ? [`pas plus de ${PIECES_MAX} fichiers par message`] : [])
    ];
    this.message.set(problemes.length ? `Non joint : ${problemes.join(' ; ')}.` : null);
  }

  taille(octets: number): string {
    if (octets < 1024) return `${octets} o`;
    if (octets < 1024 * 1024) return `${Math.round(octets / 1024)} Ko`;
    return `${(octets / (1024 * 1024)).toLocaleString('fr-FR', { maximumFractionDigits: 1 })} Mo`;
  }

  async arreter(): Promise<void> {
    const s = this.choisie();
    if (!s) return;
    try {
      await firstValueFrom(this.api.arreterIa(s.id));
    } catch (e) {
      this.erreur(e, "L'interruption a échoué.");
    }
  }

  async lancerTests(): Promise<void> {
    const s = this.choisie();
    if (!s) return;
    this.envoi.set(true);
    this.message.set(null);
    try {
      await firstValueFrom(this.api.lancerTestsIa(s.id));
      this.travail.set('tests');
    } catch (e) {
      this.erreur(e, "Les tests n'ont pas pu être lancés.");
    } finally {
      this.envoi.set(false);
    }
  }

  async merger(): Promise<void> {
    const s = this.choisie();
    if (!s) return;
    this.envoi.set(true);
    this.message.set(null);
    try {
      this.livraison.set(await firstValueFrom(this.api.mergerIa(s.id)));
      this.confirmation.set(null);
      void this.rafraichirEtat();
    } catch (e) {
      this.erreur(e, "Le merge a échoué.");
    } finally {
      this.envoi.set(false);
    }
  }

  ouvrirTag(l: LivraisonIaVue): void {
    this.tag = l.tagSuggere;
    this.confirmation.set('tag');
  }

  async tagger(): Promise<void> {
    const s = this.choisie();
    if (!s) return;
    this.envoi.set(true);
    this.message.set(null);
    try {
      this.livraison.set(await firstValueFrom(this.api.taggerEtPousserIa(s.id, this.tag.trim())));
      this.confirmation.set(null);
      this.message.set(`${this.tag.trim()} est parti sur GitHub : le serveur le déploiera dans les 5 minutes.`);
    } catch (e) {
      this.erreur(e, "Le tag n'a pas pu être poussé.");
    } finally {
      this.envoi.set(false);
    }
  }

  /** Lit la suite du journal ; relit la livraison quand un travail vient de se terminer. */
  private async suivre(): Promise<void> {
    const s = this.choisie();
    if (!s || this.lectureEnCours) return;
    this.lectureEnCours = true;
    try {
      const nouvelles = await firstValueFrom(this.api.journalIa(s.id, this.derniere()));
      if (this.choisie()?.id !== s.id || nouvelles.length === 0) return;
      this.lignes.set([...this.lignes(), ...nouvelles]);
      // Le journal fait foi : la dernière ligne significative dit si un travail est en cours.
      const derniere = [...this.lignes()].reverse()
        .find(l => ['MESSAGE', 'TESTS_LANCES', ...FINS_DE_TRAVAIL].includes(l.type));
      if (derniere) {
        this.travail.set(derniere.type === 'MESSAGE' ? 'assistant' : derniere.type === 'TESTS_LANCES' ? 'tests' : null);
      }
      if (nouvelles.some(l => FINS_DE_TRAVAIL.includes(l.type))) void this.relireLivraison();
      setTimeout(() => {
        const el = this.fil()?.nativeElement;
        if (el) el.scrollTop = el.scrollHeight;
      });
    } catch (e) {
      if ((e as HttpErrorResponse)?.status === 403) void this.verifierAcces();
      // Sinon réseau ou serveur momentanément absent : on réessaie au tour suivant.
    } finally {
      this.lectureEnCours = false;
    }
  }

  private async relireLivraison(): Promise<void> {
    const s = this.choisie();
    if (!s) return;
    try {
      const l = await firstValueFrom(this.api.livraisonIa(s.id));
      if (this.choisie()?.id === s.id) this.livraison.set(l);
    } catch (e) {
      this.erreur(e, "L'état de la branche n'a pas pu être lu.");
    }
  }

  private async rafraichirEtat(): Promise<void> {
    try {
      this.etat.set(await firstValueFrom(this.api.etatIa()));
    } catch {
      // sans conséquence : seul l'en-tête n'est pas à jour
    }
  }

  private erreur(e: unknown, defaut: string): void {
    if ((e as HttpErrorResponse)?.status === 403 && this.acces()?.ouvert) {
      void this.verifierAcces();
      return;
    }
    this.message.set((e as HttpErrorResponse)?.error?.detail ?? defaut);
  }
}
