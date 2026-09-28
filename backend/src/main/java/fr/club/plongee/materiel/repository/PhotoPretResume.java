package fr.club.plongee.materiel.repository;

import fr.club.plongee.materiel.domain.PhotoPret;

import java.time.Instant;

/** Une photo de prêt sans son contenu : de quoi afficher la liste. */
public record PhotoPretResume(Long id, Long pretId, PhotoPret.Moment moment, Long equipementId,
                              String equipementReference, String legende, Instant priseLe,
                              String prisParPrenom, String prisParNom) {}
