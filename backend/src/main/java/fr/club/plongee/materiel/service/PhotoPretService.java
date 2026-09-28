package fr.club.plongee.materiel.service;

import fr.club.plongee.commun.RegleMetierException;
import fr.club.plongee.commun.RessourceIntrouvableException;
import fr.club.plongee.materiel.domain.Equipement;
import fr.club.plongee.materiel.domain.PhotoPret;
import fr.club.plongee.materiel.domain.PhotoPret.Moment;
import fr.club.plongee.materiel.domain.Pret;
import fr.club.plongee.materiel.repository.PhotoPretRepository;
import fr.club.plongee.materiel.repository.PhotoPretResume;
import fr.club.plongee.materiel.repository.PretRepository;
import fr.club.plongee.securite.repository.UtilisateurRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.util.*;

/**
 * Photos de l'état du matériel à la remise (AVANT) et au retour (APRES)
 * d'un prêt. Photos AVANT tant que le prêt est en cours ; photos APRES
 * aussi après le retour (prises au déballage, le lendemain) ; suppression
 * seulement tant que le prêt est en cours : une fois rendu, elles font foi.
 */
@Service
public class PhotoPretService {

    static final Set<String> TYPES_PHOTO = Set.of("image/jpeg", "image/png");
    static final long TAILLE_MAX_PHOTO_OCTETS = 5L * 1024 * 1024;
    /** Par prêt et par moment : de quoi montrer chaque pièce, sans remplir la base. */
    static final int PHOTOS_MAX_PAR_MOMENT = 12;

    public record PhotoVue(Long id, Moment moment, Long equipementId, String equipementReference,
                           String legende, Instant priseLe, String prisePar) {}

    public record ContenuPhoto(byte[] contenu, String type) {}

    private final PhotoPretRepository photos;
    private final PretRepository prets;
    private final UtilisateurRepository utilisateurs;

    public PhotoPretService(PhotoPretRepository photos, PretRepository prets, UtilisateurRepository utilisateurs) {
        this.photos = photos;
        this.prets = prets;
        this.utilisateurs = utilisateurs;
    }

    @Transactional(readOnly = true)
    public List<PhotoVue> lister(Long pretId) {
        pret(pretId);
        return photos.resumes(pretId).stream().map(PhotoPretService::vue).toList();
    }

    @Transactional
    public PhotoVue deposer(Long pretId, Moment moment, Long equipementId, String legende,
                            byte[] contenu, String type, Long auteurId) {
        Pret p = pret(pretId);
        if (moment == Moment.AVANT && !p.estEnCours()) {
            throw new RegleMetierException("Ce prêt est rendu : on n'ajoute plus de photo « avant ».");
        }
        verifierImage(contenu, type);
        if (photos.countByPretIdAndMoment(pretId, moment) >= PHOTOS_MAX_PAR_MOMENT) {
            throw new RegleMetierException("Ce prêt a déjà " + PHOTOS_MAX_PAR_MOMENT + " photos « "
                    + (moment == Moment.AVANT ? "avant" : "après") + " » : c'est le maximum.");
        }
        PhotoPret photo = new PhotoPret();
        photo.setPret(p);
        photo.setMoment(moment);
        if (equipementId != null) {
            Equipement e = p.getEquipements().stream().filter(x -> x.getId().equals(equipementId)).findFirst()
                    .orElseThrow(() -> new RegleMetierException("Cet équipement ne fait pas partie du prêt."));
            photo.setEquipement(e);
        }
        photo.setLegende(legende == null || legende.isBlank() ? null : legende.trim());
        photo.setContenu(contenu);
        photo.setTypeContenu(type);
        photo.setPrisePar(utilisateurs.getReferenceById(auteurId));
        photos.save(photo);
        return photos.resumes(pretId).stream().filter(r -> r.id().equals(photo.getId()))
                .findFirst().map(PhotoPretService::vue).orElseThrow();
    }

    @Transactional(readOnly = true)
    public ContenuPhoto contenu(Long photoId) {
        PhotoPret photo = photo(photoId);
        return new ContenuPhoto(photo.getContenu(), photo.getTypeContenu());
    }

    @Transactional
    public void supprimer(Long photoId) {
        PhotoPret photo = photo(photoId);
        if (!photo.getPret().estEnCours()) {
            throw new RegleMetierException("Ce prêt est rendu : ses photos font foi et ne se suppriment plus.");
        }
        photos.delete(photo);
    }

    /** Nombre de photos AVANT et APRES par prêt, pour les listes. */
    @Transactional(readOnly = true)
    public Map<Long, Map<Moment, Long>> compter(Collection<Long> pretIds) {
        Map<Long, Map<Moment, Long>> comptes = new HashMap<>();
        if (pretIds.isEmpty()) return comptes;
        for (Object[] ligne : photos.compter(pretIds)) {
            comptes.computeIfAbsent((Long) ligne[0], k -> new EnumMap<>(Moment.class))
                    .put((Moment) ligne[1], (Long) ligne[2]);
        }
        return comptes;
    }

    /**
     * Le type annoncé par le navigateur ne suffit pas : on vérifie aussi la
     * signature du fichier, puisqu'on le resservira tel quel comme image.
     */
    private static void verifierImage(byte[] contenu, String type) {
        if (contenu == null || contenu.length == 0) throw new RegleMetierException("Le fichier est vide.");
        if (contenu.length > TAILLE_MAX_PHOTO_OCTETS) {
            throw new RegleMetierException("La photo dépasse la taille maximale de 5 Mo.");
        }
        boolean jpeg = contenu.length > 3 && (contenu[0] & 0xFF) == 0xFF && (contenu[1] & 0xFF) == 0xD8
                && (contenu[2] & 0xFF) == 0xFF;
        boolean png = contenu.length > 8 && (contenu[0] & 0xFF) == 0x89 && contenu[1] == 'P'
                && contenu[2] == 'N' && contenu[3] == 'G';
        if (type == null || !TYPES_PHOTO.contains(type)
                || (type.equals("image/jpeg") && !jpeg) || (type.equals("image/png") && !png)) {
            throw new RegleMetierException("Seules les photos JPEG ou PNG sont acceptées.");
        }
    }

    private Pret pret(Long id) {
        return prets.findById(id).orElseThrow(() -> new RessourceIntrouvableException("Prêt introuvable"));
    }

    private PhotoPret photo(Long id) {
        return photos.findById(id).orElseThrow(() -> new RessourceIntrouvableException("Photo introuvable"));
    }

    private static PhotoVue vue(PhotoPretResume r) {
        return new PhotoVue(r.id(), r.moment(), r.equipementId(), r.equipementReference(), r.legende(), r.priseLe(),
                r.prisParPrenom() == null ? null : r.prisParPrenom() + " " + r.prisParNom());
    }
}
