package fr.club.plongee.securite;

/**
 * Niveaux d'encadrement du Code du sport, dans l'ordre croissant.
 * L'ordre de declaration porte la hierarchie : E1 &lt; E2 &lt; E3 &lt; E4.
 */
public enum NiveauEncadrement {
    E1, E2, E3, E4;

    public boolean auMoins(NiveauEncadrement requis) {
        return requis == null || this.compareTo(requis) >= 0;
    }
}
