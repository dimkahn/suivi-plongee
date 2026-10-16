package fr.club.plongee.sejour.domaine;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

import java.time.LocalDate;
import java.time.LocalTime;

public record FicheEvenement(@NotNull LocalDate jour, LocalTime heureDebut, LocalTime heureFin,
                             @NotBlank @Size(max = 160) String titre, @Size(max = 160) String lieu,
                             String details) {}
