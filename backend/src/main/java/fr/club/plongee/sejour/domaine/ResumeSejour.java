package fr.club.plongee.sejour.domaine;

import java.time.LocalDate;

/** Une ligne de la liste des séjours. */
public record ResumeSejour(Long sortieId, String nom, String lieu, LocalDate dateDebut, LocalDate dateFin,
                           int participants, boolean jeParticipe) {}
