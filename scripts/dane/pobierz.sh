#!/usr/bin/env bash
# Pobiera surowe dane do data/raw. Każde źródło w osobnym folderze.
set -euo pipefail
cd "$(dirname "$0")/../.."

mkdir -p data/raw/international_results data/raw/wikipedia data/raw/clubelo

# Wyniki i strzelcy wszystkich meczów reprezentacji (CC0)
base="https://raw.githubusercontent.com/martj42/international_results/master"
curl -sfL "$base/results.csv" -o data/raw/international_results/results.csv
curl -sfL "$base/goalscorers.csv" -o data/raw/international_results/goalscorers.csv

# Składy Euro 2016 (wikitext, CC BY-SA)
curl -sfL "https://en.wikipedia.org/w/index.php?title=UEFA_Euro_2016_squads&action=raw" \
  -o data/raw/wikipedia/euro2016_squads.wikitext

# Siła klubów (ClubElo) na początek eliminacji, koniec sezonu 14/15 i przed Euro
for d in 2014-09-01 2015-06-01 2016-06-01; do
  curl -sfL "http://api.clubelo.com/$d" -o "data/raw/clubelo/$d.csv"
  sleep 1
done

ls -la data/raw/*
