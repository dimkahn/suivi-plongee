package fr.club.plongee.securite;

import org.springframework.security.core.userdetails.UserDetailsService;
import org.springframework.security.core.userdetails.UsernameNotFoundException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class DetailsUtilisateurService implements UserDetailsService {

    private final UtilisateurRepository repository;

    public DetailsUtilisateurService(UtilisateurRepository repository) {
        this.repository = repository;
    }

    @Override
    @Transactional(readOnly = true)
    public UtilisateurPrincipal loadUserByUsername(String email) {
        return repository.findByEmailIgnoreCase(email)
                .map(UtilisateurPrincipal::de)
                .orElseThrow(() -> new UsernameNotFoundException("Identifiants invalides"));
    }
}
