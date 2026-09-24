package fr.club.plongee.securite.service;

import fr.club.plongee.commun.RegleMetierException;
import fr.club.plongee.securite.domain.PhotoUtilisateur;
import fr.club.plongee.securite.domain.Utilisateur;
import fr.club.plongee.securite.repository.PhotoUtilisateurRepository;
import fr.club.plongee.securite.repository.UtilisateurRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.util.Set;

/**
 * Photo d'un moniteur pour le trombinoscope, déposée par un ADMIN
 * ({@code AdminMoniteurService}) ou par le moniteur lui-même depuis
 * « Mon compte ». Une photo n'est jamais acceptée sans le droit à l'image
 * ({@code Utilisateur.autorisationImage}), et le retirer supprime la photo.
 */
@Service
public class PhotoMoniteurService {

    private static final Set<String> TYPES_PHOTO = Set.of("image/jpeg", "image/png");
    private static final long TAILLE_MAX_PHOTO_OCTETS = 5L * 1024 * 1024;

    private final UtilisateurRepository utilisateurs;
    private final PhotoUtilisateurRepository photos;

    public PhotoMoniteurService(UtilisateurRepository utilisateurs, PhotoUtilisateurRepository photos) {
        this.utilisateurs = utilisateurs;
        this.photos = photos;
    }

    /** Un retrait de consentement supprime la photo elle-meme, pas seulement son affichage. */
    @Transactional
    public void changerAutorisationImage(Utilisateur u, boolean autorisation) {
        u.setAutorisationImage(autorisation);
        utilisateurs.save(u);
        if (!autorisation) supprimer(u.getId());
    }

    @Transactional
    public void deposer(Utilisateur u, byte[] contenu, String type) {
        if (!u.isAutorisationImage()) {
            throw new RegleMetierException(
                    "Le droit à l'image n'a pas été recueilli pour ce moniteur : "
                            + "cochez d'abord l'autorisation avant de déposer une photo.");
        }
        if (contenu == null || contenu.length == 0) {
            throw new RegleMetierException("Le fichier est vide.");
        }
        if (contenu.length > TAILLE_MAX_PHOTO_OCTETS) {
            throw new RegleMetierException("La photo dépasse la taille maximale de 5 Mo.");
        }
        if (type == null || !TYPES_PHOTO.contains(type)) {
            throw new RegleMetierException("Seules les photos JPEG ou PNG sont acceptées.");
        }
        PhotoUtilisateur photo = photos.findById(u.getId()).orElseGet(PhotoUtilisateur::new);
        photo.setUtilisateur(u);
        photo.setContenu(contenu);
        photo.setTypeContenu(type);
        photo.setMiseAJourLe(Instant.now());
        photos.save(photo);
    }

    @Transactional
    public void supprimer(Long utilisateurId) {
        if (photos.existsById(utilisateurId)) photos.deleteById(utilisateurId);
    }

    @Transactional(readOnly = true)
    public boolean aPhoto(Utilisateur u) {
        return u.isAutorisationImage() && photos.existsById(u.getId());
    }
}
