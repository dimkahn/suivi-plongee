package fr.club.plongee.sejour.domaine;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

import java.util.List;

public record FicheVoiture(@NotBlank @Size(max = 120) String nom, @NotNull Integer places, Long conducteurId,
                           @Size(max = 200) String trajet, String remarques, List<Long> passagerIds) {}
