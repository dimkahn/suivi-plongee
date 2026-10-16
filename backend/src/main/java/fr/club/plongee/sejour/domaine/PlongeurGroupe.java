package fr.club.plongee.sejour.domaine;

/** Un plongeur d'un groupe, auquel lier un participant. */
public record PlongeurGroupe(Long id, Long eleveId, Long utilisateurId, String nom, String prenom,
                             String email, String aptitude) {}
