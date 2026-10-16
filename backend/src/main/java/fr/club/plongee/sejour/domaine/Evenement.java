package fr.club.plongee.sejour.domaine;

import java.time.LocalDate;
import java.time.LocalTime;

/** Un rendez-vous du programme. */
public record Evenement(Long id, LocalDate jour, LocalTime heureDebut, LocalTime heureFin, String titre,
                        String lieu, String details) {}
