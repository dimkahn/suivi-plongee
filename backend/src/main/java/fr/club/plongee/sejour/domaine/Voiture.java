package fr.club.plongee.sejour.domaine;

import java.util.List;

public record Voiture(Long id, String nom, int places, Long conducteurId, String trajet, String remarques,
                      List<Long> passagerIds) {}
