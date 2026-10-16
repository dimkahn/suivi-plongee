package fr.club.plongee.sejour.domaine;

import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

import java.util.List;

/** Un logement et ses chambres, remplacées d'un bloc. */
public record FicheLogement(@NotBlank @Size(max = 120) String nom, @Size(max = 300) String adresse,
                            String remarques, List<@Valid FicheChambre> chambres) {}
