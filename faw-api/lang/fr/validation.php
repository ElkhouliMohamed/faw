<?php

return [
    'required' => 'Le champ :attribute est obligatoire.',
    'string' => 'Le champ :attribute doit être du texte.',
    'email' => 'Le champ :attribute doit être une adresse email valide.',
    'integer' => 'Le champ :attribute doit être un nombre entier.',
    'numeric' => 'Le champ :attribute doit être numérique.',
    'boolean' => 'Le champ :attribute est invalide.',
    'array' => 'Le champ :attribute doit être une liste.',
    'regex' => 'Le format du champ :attribute est invalide.',
    'in' => 'La valeur du champ :attribute n’est pas autorisée.',
    'unique' => 'Cette valeur de :attribute est déjà utilisée.',
    'min' => ['string' => 'Le champ :attribute doit contenir au moins :min caractères.', 'numeric' => 'Le champ :attribute doit être au moins :min.', 'array' => 'Ajoutez au moins :min élément(s).'],
    'max' => ['string' => 'Le champ :attribute ne doit pas dépasser :max caractères.', 'numeric' => 'Le champ :attribute ne doit pas dépasser :max.', 'array' => 'Le champ :attribute ne doit pas dépasser :max éléments.'],
    'attributes' => ['name' => 'nom', 'customerName' => 'nom', 'phone' => 'téléphone', 'city' => 'ville', 'address' => 'adresse', 'items' => 'produits', 'paymentMethod' => 'moyen de paiement', 'deliveryMode' => 'mode de livraison', 'company' => 'entreprise', 'email' => 'email'],
];
