package fr.club.plongee.sejour.domaine;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

import java.util.List;

public record FicheChambre(@NotBlank @Size(max = 120) String nom, @NotNull Integer couchages,
                           @Size(max = 300) String remarques, List<Long> occupantIds) {}
