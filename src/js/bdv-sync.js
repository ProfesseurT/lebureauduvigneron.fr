/* Le Bureau du Vigneron, synchronisation des donnees du vigneron avec Supabase.

   Decision de Ted du 04/09/2026 : les reglages, le suivi client ET les lignes de vente sont
   gardes sur le serveur et redistribues a la demande. Les questions juridiques, de securite
   et l'arbitrage avec l'associe sont reportees, rien n'etant deploye chez un client a cette date.

   TROIS REGLES QUI TIENNENT TOUT LE FICHIER

   1. IndexedDB reste la source de calcul, jamais le serveur.
      Le tableau de bord lit et calcule sur la base locale, exactement comme avant. Le serveur
      ne fait que garder une copie et la rendre sur un autre appareil. Ca veut dire qu'aucun
      ecran n'a besoin d'etre reecrit, et qu'une panne reseau ne casse rien de visible.

   2. Aucune fonction d'ici ne doit jamais empecher l'outil de s'ouvrir.
      Tout ce qui parle au reseau echoue en silence, renvoie un compte rendu, et laisse
      l'appelant continuer. Un vigneron ne doit jamais se retrouver enferme dehors de ses
      propres chiffres parce que notre serveur tousse.

   3. L'empreinte est la meme des deux cotes.
      `h`, le cyrb53 calcule sur les 40 premieres colonnes, sert de cle locale ET de cle
      serveur. Changer HASH_COLS rendrait meconnaissables les lignes deja en base, et le
      prochain import doublerait le chiffre d'affaires en silence, des deux cotes a la fois. */
(function(){
  'use strict';

  // PostgREST plafonne une reponse a 1000 lignes par defaut. On pagine explicitement plutot
  // que de faire confiance a un reglage serveur qu'on ne controle pas.
  const PAGE = 1000;
  // Un export reel fait quelques milliers de lignes. Envoyer tout d'un bloc produit un corps
  // de plusieurs megaoctets, qui passe mal sur une connexion de domaine. On decoupe, et on
  // peut afficher une progression honnete au passage.
  const LOT = 500;

  function pret(){
    return !!(window.BdvCompte && BdvCompte.monId && BdvCompte.monId());
  }

  /* ============================ LES LIGNES DE VENTE ============================ */

  // Rend toutes les lignes du serveur au format local {h, raw}, pret pour dbAddMany.
  // `surProgres(recues)` est optionnel, appele apres chaque page.
  async function tirerVentes(surProgres){
    if(!pret()) return [];
    const sorties = [];
    let depuis = 0;
    for(;;){
      const page = await BdvCompte.api(
        '/ventes?select=empreinte,brut&order=empreinte.asc&limit=' + PAGE + '&offset=' + depuis);
      if(!page || !page.length) break;
      page.forEach(function(l){ sorties.push({ h: l.empreinte, raw: l.brut }); });
      if(surProgres) surProgres(sorties.length);
      if(page.length < PAGE) break;
      depuis += PAGE;
    }
    return sorties;
  }

  // Envoie des lignes {h, raw}. Les doublons sont ignores par le serveur grace a la cle
  // primaire (id, empreinte) : deux appareils qui importent le meme export en meme temps ne
  // peuvent pas creer de doublon, meme si les deux croient etre les premiers.
  //
  // `resolution=merge-duplicates` et pas `ignore-duplicates`, volontairement : un export plus
  // recent peut porter des colonnes hors empreinte (les adresses e-mail arrivees en aout 2026).
  // Ignorer le doublon garderait l'ancienne ligne incomplete, exactement ce que rawEnrichit()
  // evite en local. On ecrase donc la ligne par la version qui arrive.
  async function pousserVentes(items, surProgres){
    if(!pret() || !items || !items.length) return { envoyees: 0, echecs: 0 };
    const moi = BdvCompte.monId();
    let envoyees = 0, echecs = 0;
    for(let i = 0; i < items.length; i += LOT){
      const lot = items.slice(i, i + LOT).map(function(it){
        return { id: moi, empreinte: it.h, brut: it.raw, maj_le: new Date().toISOString() };
      });
      try{
        await BdvCompte.api('/ventes?on_conflict=id,empreinte', {
          methode: 'POST',
          corps: lot,
          entetes: { 'Prefer': 'resolution=merge-duplicates,return=minimal' }
        });
        envoyees += lot.length;
      }catch(e){
        echecs += lot.length;
      }
      if(surProgres) surProgres(Math.min(i + LOT, items.length), items.length);
    }
    return { envoyees: envoyees, echecs: echecs };
  }

  /* ============================== LES REGLAGES ============================== */
  // Un seul enregistrement par vigneron. Remplace bdv_objectif_v5, bdv_exercice_v1,
  // bdv_persolabels_v4 et le classement de l'ecran Reglages, qui vivaient dans le
  // localStorage et disparaissaient avec le navigateur.

  async function lireReglages(){
    if(!pret()) return null;
    const lignes = await BdvCompte.api('/reglages?select=*&limit=1');
    return (lignes && lignes[0]) || null;
  }

  // Ecriture complete, jamais partielle : c'est un enregistrement unique, et l'appelant
  // connait toujours l'etat entier. `on_conflict=id` cree la ligne au premier appel.
  async function ecrireReglages(champs){
    if(!pret()) return false;
    const corps = Object.assign({ id: BdvCompte.monId(), maj_le: new Date().toISOString() }, champs);
    try{
      await BdvCompte.api('/reglages?on_conflict=id', {
        methode: 'POST',
        corps: [corps],
        entetes: { 'Prefer': 'resolution=merge-duplicates,return=minimal' }
      });
      return true;
    }catch(e){ return false; }
  }

  /* ============================ LE SUIVI CLIENT ============================ */
  // Cle = le NUMERO client Vitisoft, seul. Decision du 04/09/2026 : la colonne est toujours
  // remplie dans un export, donc une fiche ne s'orpheline pas quand le vigneron corrige
  // l'orthographe d'un nom. Le nom ne sert plus qu'a l'affichage.

  // Rend la meme forme que la structure CRM locale : {clientId: {statut, notes, rappel, canal, tags}}
  async function lireSuivi(){
    if(!pret()) return {};
    const lignes = await BdvCompte.api('/suivi_clients?select=client_id,statut,notes,rappel,canal,tags');
    const out = {};
    (lignes || []).forEach(function(l){
      const c = {};
      if(l.statut) c.statut = l.statut;
      if(l.notes)  c.notes  = l.notes;
      if(l.rappel) c.rappel = l.rappel;
      if(l.canal)  c.canal  = l.canal;
      if(l.tags && l.tags.length) c.tags = l.tags;
      out[l.client_id] = c;
    });
    return out;
  }

  async function ecrireSuivi(clientId, fiche){
    if(!pret() || !clientId) return false;
    fiche = fiche || {};
    const corps = {
      id: BdvCompte.monId(),
      client_id: String(clientId),
      statut: fiche.statut || null,
      notes:  fiche.notes  || null,
      rappel: fiche.rappel || null,
      canal:  fiche.canal  || null,
      tags:   fiche.tags   || [],
      maj_le: new Date().toISOString()
    };
    try{
      await BdvCompte.api('/suivi_clients?on_conflict=id,client_id', {
        methode: 'POST',
        corps: [corps],
        entetes: { 'Prefer': 'resolution=merge-duplicates,return=minimal' }
      });
      return true;
    }catch(e){ return false; }
  }

  // Une fiche videe par le vigneron doit disparaitre du serveur, pas y rester vide. Sinon la
  // table gonfle de fiches fantomes qu'aucun ecran ne montre plus.
  async function supprimerSuivi(clientId){
    if(!pret() || !clientId) return false;
    try{
      await BdvCompte.api('/suivi_clients?client_id=eq.' + encodeURIComponent(clientId), {
        methode: 'DELETE',
        entetes: { 'Prefer': 'return=minimal' }
      });
      return true;
    }catch(e){ return false; }
  }

  /* ============================== TOUT EFFACER ============================== */
  // Appelle la fonction SQL, qui vide les trois tables du compte appelant en une transaction.
  // Bornee a auth.uid() cote serveur : elle ne peut rien effacer chez quelqu'un d'autre.
  async function effacerTout(){
    if(!pret()) return false;
    try{
      await BdvCompte.api('/rpc/effacer_mes_donnees', { methode: 'POST', corps: {} });
      return true;
    }catch(e){ return false; }
  }

  window.BdvSync = {
    pret: pret,
    tirerVentes: tirerVentes,
    pousserVentes: pousserVentes,
    lireReglages: lireReglages,
    ecrireReglages: ecrireReglages,
    lireSuivi: lireSuivi,
    ecrireSuivi: ecrireSuivi,
    supprimerSuivi: supprimerSuivi,
    effacerTout: effacerTout
  };
})();
