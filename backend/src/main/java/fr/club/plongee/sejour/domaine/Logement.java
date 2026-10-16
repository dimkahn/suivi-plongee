package fr.club.plongee.sejour.domaine;

import java.util.List;

public record Logement(Long id, String nom, String adresse, String remarques, List<Chambre> chambres) {}
