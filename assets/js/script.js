document.addEventListener('DOMContentLoaded', () => {
    console.log("Dyty Automobile : Le site est chargé !");

    const contactForm = document.getElementById('contact-form');

    if (contactForm) {
        contactForm.addEventListener('submit', function(event) {
            // Empêche l'envoi classique du formulaire (qui échouerait sans backend)
            event.preventDefault(); 
            
            // Validation simple
            const name = this.querySelector('[name="name"]').value;
            const email = this.querySelector('[name="email"]').value;
            const message = this.querySelector('[name="message"]').value;

            if (name && email && message) {
                // Affichage d'un message de succès (simulé)
                alert(`Merci ${name} ! Votre message a été reçu par Dyty Automobile. Nous vous contacterons à l'adresse ${email} très prochainement.`);
                
                // Réinitialiser le formulaire
                this.reset();
            } else {
                alert("Veuillez remplir tous les champs du formulaire de contact.");
            }
        });
    }
});