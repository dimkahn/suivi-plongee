package fr.club.plongee.sejour.domaine;

public record Affaire(Long id, CategorieAffaire categorie, String libelle, boolean indispensable) {}
