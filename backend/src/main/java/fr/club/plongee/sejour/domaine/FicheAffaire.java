package fr.club.plongee.sejour.domaine;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

public record FicheAffaire(@NotNull CategorieAffaire categorie, @NotBlank @Size(max = 200) String libelle,
                           boolean indispensable) {}
