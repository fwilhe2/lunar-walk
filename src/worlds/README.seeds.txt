/* ── Worlds ─────────────────────────────────────────────────────
   One kernel, every body. Gravity and radius are the real
   values; the rest describes what the ground actually looks
   like on each, and is shared verbatim with the mesh workers.

   kind selects the height function: 0 = airless mare/highland
   (Moon), 1 = wind-worked desert (Mars), 2 = saturated
   captured-asteroid regolith (Phobos, Deimos), 3 = young flood
   basalt under 92 bar (Venus), 4 = a young ice shell broken by
   its own tides (Europa), 5 = old tholin-mantled ice under a
   nitrogen haze (Pluto), 6 = ice plains flooded from below (Charon),
   7 = cratered plains broken by a shrinking planet (Mercury).

   Seeds are the dates that matter: Apollo 11's launch, Viking 1's
   launch, Asaph Hall's two nights in August 1877, the morning
   Venera 9 sent back the first picture ever taken on another
   planet's surface, the night in January 1610 Galileo first saw
   Europa and Io as two points of light instead of one, and the
   day in February 1930 Clyde Tombaugh found Pluto on a pair of
   photographic plates, the day in June 1978 James Christy noticed
   that Pluto's image had a bump on it that moved, and the day in
   March 1974 Mariner 10 flew past Mercury and showed it had a face. */