package fr.club.plongee.sejour.domaine;

import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

import java.util.Set;

/** Ce qu'un organisateur saisit d'un participant (pré-rempli du dossier élève ou du compte). */
public record FicheParticipant(Long eleveId, Long utilisateurId,
                               @NotBlank @Size(max = 120) String nom, @NotBlank @Size(max = 120) String prenom,
                               boolean plongeur, @Size(max = 30) String telephone,
                               @Size(max = 180) String email, Set<RegimeAlimentaire> regimes,
                               @Size(max = 300) String regimePrecision,
                               @Size(max = 120) String urgenceNom, @Size(max = 30) String urgenceTelephone,
                               @Valid Trajet arrivee, @Valid Trajet depart, String remarques,
                               Long membreGroupeId) {}
