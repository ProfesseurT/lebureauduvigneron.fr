#!/usr/bin/env python3
# ============================================================================
# scripts/fixtures/devis-calculs.py : LA TABLE DE CAS DU DEVIS, lot 47 (30/09/2026)
# ----------------------------------------------------------------------------
# Ecrit scripts/fixtures/devis-calculs.json, la table que se partagent
# src/js/bdv-devis-calcul.js (npm run banc:devis) et la RPC devis_enregistrer
# (supabase/banc-lot47-devis.sql). Les valeurs attendues sont calculees ICI, en
# Python et en decimal exact (ROUND_HALF_UP), SANS lire une ligne du JavaScript :
# une table produite par le code qu'elle controle ne controlerait rien.
#
#   python3 scripts/fixtures/devis-calculs.py
#
# Bornes de la base, respectees par chaque cas : pu_c 0..9 999 999, quantite
# 1..99 999, remises 0..10 000, 1 a 200 lignes.
# ============================================================================
import json, os
from decimal import Decimal, ROUND_HALF_UP

def arrondi(x):
    return int(Decimal(x).quantize(Decimal(1), rounding=ROUND_HALF_UP))

def calcule(lignes, g, tva_cb=2000):
    sortie, vins, ht = [], 0, 0
    for l in lignes:
        pu, q, rl = Decimal(l['pu_c']), l['qte'], Decimal(l['remise_cb'])
        pu_l = arrondi(pu * (10000 - rl) / 10000)
        pu_f = arrondi(Decimal(pu_l) * (10000 - Decimal(g)) / 10000)
        sortie.append({'pu_l': pu_l, 'pu_f': pu_f, 'net': q * pu_l, 'final': q * pu_f})
        vins += q * pu_l
        ht += q * pu_f
    tva = arrondi(Decimal(ht) * tva_cb / 10000)
    return {'lignes': sortie, 'total_vins': vins, 'remise_globale': vins - ht,
            'total_ht': ht, 'tva': tva, 'ttc': ht + tva}

def L(pu, q, r=0):
    return {'pu_c': pu, 'qte': q, 'remise_cb': r}

CAS = [
    ('sans remise, 6 x 8,50', [L(850, 6)], 0),
    ('remise de ligne 0 % et 100 %', [L(1290, 12, 0), L(1290, 6, 10000)], 0),
    ('remise globale 100 %', [L(2150, 3), L(990, 24, 1500)], 10000),
    ('demi centime vers le haut : 10,05 a 50 %', [L(1005, 1, 5000)], 0),
    ('demi centime a la remise globale : 9,99 a 50 % puis 50 %', [L(999, 7, 5000)], 5000),
    ('quart de centime vers le bas : 0,01 a 75 %', [L(1, 3, 7500)], 0),
    ('remise ligne 12,5 % et globale 5 %', [L(1200, 2, 1250), L(999, 3, 1250), L(1450, 6)], 500),
    ('remise globale 12,34 % : le montant de remise est la difference', [L(333, 7), L(1017, 11), L(2999, 1)], 1234),
    ('TVA sur le total : 3 x 0,02', [L(2, 1), L(2, 1), L(2, 1)], 0),
    ('TVA 0,6 centime vers le haut, 0,4 vers le bas', [L(3, 1), L(2, 1)], 0),
    ('prix nul (offert) dans un devis', [L(0, 6), L(1850, 6, 1000)], 2500),
    ('bornes : 99 999,99 EUR x 99 999, remises 0,01 %', [L(9999999, 99999, 1)], 1),
    ('200 lignes de 0,01 a 50 % puis 50 %', [L(1, 1, 5000) for _ in range(200)], 5000),
    ('200 lignes aux bornes : la TVA depasse 2^53', [L(9999999 - i, 99999 - i, 3333) for i in range(200)], 777),
    ('remise 33,33 % sur 99 999 bouteilles a 0,01', [L(1, 99999, 3333)], 0),
    ('remise 99,99 % et globale 99,99 %', [L(9999999, 2, 9999), L(123457, 3, 9999)], 9999),
    ('quantites variees, prix a demi centime', [L(1235, i + 1, 2500 + 10 * i) for i in range(40)], 333),
]

sortie = {'_': 'Genere par scripts/fixtures/devis-calculs.py (Decimal, ROUND_HALF_UP). Ne pas editer a la main.',
          'cas': []}
for nom, lignes, g in CAS:
    assert 1 <= len(lignes) <= 200
    for l in lignes:
        assert 0 <= l['pu_c'] <= 9999999 and 1 <= l['qte'] <= 99999 and 0 <= l['remise_cb'] <= 10000
    sortie['cas'].append({'nom': nom, 'lignes': lignes, 'remise_globale_cb': g, 'attendu': calcule(lignes, g)})

chemin = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'devis-calculs.json')
with open(chemin, 'w', encoding='utf-8') as f:
    json.dump(sortie, f, ensure_ascii=False, separators=(',', ':'))
    f.write('\n')
print(len(sortie['cas']), 'cas ecrits dans', chemin)
