package fr.club.plongee.sejour.domaine;

import java.util.List;

public record Chambre(Long id, String nom, int couchages, String remarques, List<Long> occupantIds) {}
