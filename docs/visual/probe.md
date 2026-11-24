# Visual index probe

Index: 30815 cards (dinov2s-int8.onnx, built 2026-11-24T17:18:11Z); 19914 cards without an image. Photos: 14.

Similarity (cosine, int8) of the right card and of the best wrong card, cut "find":

| parts | photo | right card | right | best wrong |
|---|---|---|---|---|
| art | 1 | me02-040 | 0.898 | 0.809 |
| art | 2 | me02-088 | 0.913 | 0.757 |
| art | 3 | me02-081 | 0.914 | 0.779 |
| art | 4 | me02-049 | 0.930 | 0.814 |
| art | 5 | me02-057 | 0.906 | 0.724 |
| art | 7 | me02-032 | 0.807 | 0.807 |
| art | 9 | me02-048 | 0.871 | 0.747 |
| art | 10 | me02-038 | 0.909 | 0.754 |
| art | 11 | me02-091 | 0.906 | 0.756 |
| art | 13 | base2-8 | 0.805 | 0.852 |
| art | 14 | base1-10 | 0.776 | 0.719 |
| art | 15 | basep-46 | 0.819 | 0.673 |
| fullcls+art | 1 | me02-040 | 0.858 | 0.778 |
| fullcls+art | 2 | me02-088 | 0.881 | 0.705 |
| fullcls+art | 3 | me02-081 | 0.887 | 0.752 |
| fullcls+art | 4 | me02-049 | 0.893 | 0.763 |
| fullcls+art | 5 | me02-057 | 0.880 | 0.711 |
| fullcls+art | 7 | me02-032 | 0.786 | 0.786 |
| fullcls+art | 9 | me02-048 | 0.845 | 0.718 |
| fullcls+art | 10 | me02-038 | 0.868 | 0.729 |
| fullcls+art | 11 | me02-091 | 0.886 | 0.760 |
| fullcls+art | 13 | base2-8 | 0.789 | 0.789 |
| fullcls+art | 14 | base1-10 | 0.725 | 0.702 |
| fullcls+art | 15 | basep-46 | 0.736 | 0.660 |
| full+art | 1 | me02-040 | 0.856 | 0.792 |
| full+art | 2 | me02-088 | 0.877 | 0.722 |
| full+art | 3 | me02-081 | 0.879 | 0.763 |
| full+art | 4 | me02-049 | 0.887 | 0.777 |
| full+art | 5 | me02-057 | 0.875 | 0.750 |
| full+art | 7 | me02-032 | 0.784 | 0.788 |
| full+art | 9 | me02-048 | 0.846 | 0.748 |
| full+art | 10 | me02-038 | 0.857 | 0.751 |
| full+art | 11 | me02-091 | 0.876 | 0.756 |
| full+art | 13 | base2-8 | 0.792 | 0.785 |
| full+art | 14 | base1-10 | 0.727 | 0.716 |
| full+art | 15 | basep-46 | 0.746 | 0.697 |
| fullcls+artcls | 1 | me02-040 | 0.826 | 0.753 |
| fullcls+artcls | 2 | me02-088 | 0.858 | 0.657 |
| fullcls+artcls | 3 | me02-081 | 0.869 | 0.723 |
| fullcls+artcls | 4 | me02-049 | 0.865 | 0.737 |
| fullcls+artcls | 5 | me02-057 | 0.853 | 0.703 |
| fullcls+artcls | 7 | me02-032 | 0.766 | 0.767 |
| fullcls+artcls | 9 | me02-048 | 0.807 | 0.694 |
| fullcls+artcls | 10 | me02-038 | 0.838 | 0.697 |
| fullcls+artcls | 11 | me02-091 | 0.875 | 0.735 |
| fullcls+artcls | 13 | base2-8 | 0.791 | 0.766 |
| fullcls+artcls | 14 | base1-10 | 0.714 | 0.719 |
| fullcls+artcls | 15 | basep-46 | 0.680 | 0.641 |

Packed for the phone:

| cut | parts | dims | bits | size | top-1 | top-5 | ranks |
|---|---|---|---|---|---|---|---|
| find | art | 768 | 8 | 23.8 MB | 10/12 | 12/12 | 1, 1, 1, 1, 1, 2, 1, 1, 1, 3, 1, 1 |
| trim | art | 768 | 8 | 23.8 MB | 10/12 | 12/12 | 1, 1, 1, 1, 1, 2, 1, 1, 1, 3, 1, 1 |
| find | art | 768 | 4 | 12.0 MB | 10/12 | 12/12 | 1, 1, 1, 1, 1, 2, 1, 1, 1, 3, 1, 1 |
| trim | art | 768 | 4 | 12.0 MB | 10/12 | 12/12 | 1, 1, 1, 1, 1, 2, 1, 1, 1, 3, 1, 1 |
| find | art | 768 | 1 | 3.0 MB | 11/12 | 12/12 | 1, 1, 1, 1, 1, 1, 1, 1, 1, 2, 1, 1 |
| trim | art | 768 | 1 | 3.0 MB | 11/12 | 12/12 | 1, 1, 1, 1, 1, 1, 1, 1, 1, 2, 1, 1 |
| find | fullcls+art | 1152 | 8 | 35.6 MB | 10/12 | 12/12 | 1, 1, 1, 1, 1, 2, 1, 1, 1, 2, 1, 1 |
| trim | fullcls+art | 1152 | 8 | 35.6 MB | 10/12 | 12/12 | 1, 1, 1, 1, 1, 2, 1, 1, 1, 2, 1, 1 |
| find | fullcls+art | 1152 | 4 | 17.9 MB | 10/12 | 12/12 | 1, 1, 1, 1, 1, 2, 1, 1, 1, 2, 1, 1 |
| trim | fullcls+art | 1152 | 4 | 17.9 MB | 10/12 | 12/12 | 1, 1, 1, 1, 1, 2, 1, 1, 1, 2, 1, 1 |
| find | fullcls+art | 1152 | 1 | 4.4 MB | 11/12 | 12/12 | 1, 1, 1, 1, 1, 4, 1, 1, 1, 1, 1, 1 |
| trim | fullcls+art | 1152 | 1 | 4.4 MB | 11/12 | 12/12 | 1, 1, 1, 1, 1, 4, 1, 1, 1, 1, 1, 1 |
| find | full+art | 1536 | 8 | 47.5 MB | 11/12 | 12/12 | 1, 1, 1, 1, 1, 2, 1, 1, 1, 1, 1, 1 |
| trim | full+art | 1536 | 8 | 47.5 MB | 11/12 | 12/12 | 1, 1, 1, 1, 1, 2, 1, 1, 1, 1, 1, 1 |
| find | full+art | 1536 | 4 | 23.8 MB | 11/12 | 12/12 | 1, 1, 1, 1, 1, 4, 1, 1, 1, 1, 1, 1 |
| trim | full+art | 1536 | 4 | 23.8 MB | 11/12 | 12/12 | 1, 1, 1, 1, 1, 4, 1, 1, 1, 1, 1, 1 |
| find | full+art | 1536 | 1 | 5.9 MB | 10/12 | 11/12 | 1, 1, 1, 1, 1, 7, 1, 1, 1, 1, 1, 3 |
| trim | full+art | 1536 | 1 | 5.9 MB | 10/12 | 11/12 | 1, 1, 1, 1, 1, 7, 1, 1, 1, 1, 1, 3 |
| find | fullcls+artcls | 768 | 8 | 23.8 MB | 10/12 | 12/12 | 1, 1, 1, 1, 1, 2, 1, 1, 1, 1, 2, 1 |
| trim | fullcls+artcls | 768 | 8 | 23.8 MB | 10/12 | 12/12 | 1, 1, 1, 1, 1, 2, 1, 1, 1, 1, 2, 1 |
| find | fullcls+artcls | 768 | 4 | 12.0 MB | 11/12 | 12/12 | 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 2, 1 |
| trim | fullcls+artcls | 768 | 4 | 12.0 MB | 11/12 | 12/12 | 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 2, 1 |
| find | fullcls+artcls | 768 | 1 | 3.0 MB | 10/12 | 12/12 | 1, 1, 1, 1, 1, 4, 1, 1, 1, 1, 4, 1 |
| trim | fullcls+artcls | 768 | 1 | 3.0 MB | 10/12 | 12/12 | 1, 1, 1, 1, 1, 4, 1, 1, 1, 1, 4, 1 |

| cut | compare | top-1 | top-5 | top-20 | ranks |
|---|---|---|---|---|---|
| find | full cls | 9/12 | 9/12 | 10/12 | 1, 1, 1, 1, 1, None, 16, None, 1, 1, 1, 1, 204, 482 |
| find | full mean | 3/12 | 4/12 | 7/12 | 18, 1, 1, 5, 12, None, 800, None, 111, 1277, 1, 19, 919, 174 |
| find | full both | 7/12 | 9/12 | 9/12 | 2, 1, 1, 1, 1, None, 80, None, 1, 2, 1, 1, 244, 207 |
| find | art both | 10/12 | 12/12 | 12/12 | 1, 1, 1, 1, 1, None, 2, None, 1, 1, 1, 3, 1, 1 |
| find | full+art | 11/12 | 12/12 | 12/12 | 1, 1, 1, 1, 1, None, 2, None, 1, 1, 1, 1, 1, 1 |
| find | dhash full | 9/12 | 10/12 | 10/12 | 1, 1, 1, 1, 1, None, 599, None, 1, 1, 1, 5034, 4, 1 |
| find | dhash art | 9/12 | 10/12 | 10/12 | 1, 1, 1, 1, 1, None, 141, None, 1, 1, 1, 1769, 3, 1 |
| trim | full cls | 8/12 | 9/12 | 10/12 | 1, 1, 1, 4, 1, None, 16, None, 1, 1, 1, 1, 204, 482 |
| trim | full mean | 0/12 | 0/12 | 3/12 | 104, 6, 475, 1476, 136, None, 800, None, 3487, 4112, 13, 19, 919, 174 |
| trim | full both | 6/12 | 8/12 | 9/12 | 6, 1, 1, 4, 1, None, 80, None, 2, 1, 1, 1, 244, 207 |
| trim | art both | 10/12 | 12/12 | 12/12 | 1, 1, 1, 1, 1, None, 2, None, 1, 1, 1, 3, 1, 1 |
| trim | full+art | 11/12 | 12/12 | 12/12 | 1, 1, 1, 1, 1, None, 2, None, 1, 1, 1, 1, 1, 1 |
| trim | dhash full | 6/12 | 9/12 | 9/12 | 1, 1, 1, 1, 3, None, 599, None, 63, 1, 4, 5034, 4, 1 |
| trim | dhash art | 5/12 | 7/12 | 7/12 | 1, 1, 1, 76, 33, None, 141, None, 27, 3, 1, 1769, 3, 1 |

| cut | compare | photo | right card | rank | first | second | gap |
|---|---|---|---|---|---|---|---|
| find | full cls | 1 | me02-040 | 1 | me02-040 0.777 | sv08-050 0.771 | 0.006 |
| find | full cls | 2 | me02-088 | 1 | me02-088 0.818 | me02.5-197 0.697 | 0.121 |
| find | full cls | 3 | me02-081 | 1 | me02-081 0.830 | S8-059 0.700 | 0.130 |
| find | full cls | 4 | me02-049 | 1 | me02-049 0.818 | me06-020 0.744 | 0.074 |
| find | full cls | 5 | me02-057 | 1 | me02-057 0.826 | sv01-132 0.770 | 0.056 |
| find | full cls | 7 | me02-032 | 16 | smp-SM110 0.772 | ex2-38 0.766 | 0.005 |
| find | full cls | 9 | me02-048 | 1 | me02-048 0.793 | sv05-039 0.743 | 0.050 |
| find | full cls | 10 | me02-038 | 1 | me02-038 0.786 | S12-045 0.736 | 0.050 |
| find | full cls | 11 | me02-091 | 1 | me02-091 0.846 | M4-105 0.769 | 0.077 |
| find | full cls | 13 | base2-8 | 1 | base2-8 0.755 | base4-14 0.734 | 0.021 |
| find | full cls | 14 | base1-10 | 204 | ecard2-95a 0.705 | CP6-049 0.683 | 0.022 |
| find | full cls | 15 | basep-46 | 482 | ecard2-95a 0.670 | smp-SM109 0.662 | 0.008 |
| find | full mean | 1 | me02-040 | 18 | sv08-050 0.866 | S12a-006 0.861 | 0.005 |
| find | full mean | 2 | me02-088 | 1 | me02-088 0.864 | sv04.5-081 0.835 | 0.029 |
| find | full mean | 3 | me02-081 | 1 | me02-081 0.855 | mep-069 0.838 | 0.017 |
| find | full mean | 4 | me02-049 | 5 | mep-069 0.879 | sv08-050 0.877 | 0.003 |
| find | full mean | 5 | me02-057 | 12 | sv01-133 0.876 | me03-050 0.875 | 0.001 |
| find | full mean | 7 | me02-032 | 800 | ecard2-95b 0.872 | ecard2-95a 0.862 | 0.010 |
| find | full mean | 9 | me02-048 | 111 | sv04-059 0.874 | sv04-061 0.873 | 0.001 |
| find | full mean | 10 | me02-038 | 1277 | S12-045 0.872 | sv02-068 0.868 | 0.004 |
| find | full mean | 11 | me02-091 | 1 | me02-091 0.846 | me02.5-181 0.839 | 0.008 |
| find | full mean | 13 | base2-8 | 19 | ecard2-H27 0.848 | ecard2-103b 0.846 | 0.002 |
| find | full mean | 14 | base1-10 | 919 | ecard2-95a 0.857 | ecard2-95b 0.848 | 0.009 |
| find | full mean | 15 | basep-46 | 174 | ecard2-H27 0.856 | ecard2-103b 0.853 | 0.003 |
| find | full both | 1 | me02-040 | 2 | sv08-050 1.637 | me02-040 1.629 | 0.008 |
| find | full both | 2 | me02-088 | 1 | me02-088 1.682 | me02.5-197 1.531 | 0.151 |
| find | full both | 3 | me02-081 | 1 | me02-081 1.686 | S8-059 1.493 | 0.192 |
| find | full both | 4 | me02-049 | 1 | me02-049 1.693 | me04-020 1.597 | 0.096 |
| find | full both | 5 | me02-057 | 1 | me02-057 1.687 | sv01-133 1.639 | 0.048 |
| find | full both | 7 | me02-032 | 80 | smp-SM110 1.613 | ecard2-95a 1.610 | 0.002 |
| find | full both | 9 | me02-048 | 1 | me02-048 1.641 | sv05-039 1.615 | 0.026 |
| find | full both | 10 | me02-038 | 2 | S12-045 1.608 | me02-038 1.608 | 0.000 |
| find | full both | 11 | me02-091 | 1 | me02-091 1.693 | M4-105 1.513 | 0.179 |
| find | full both | 13 | base2-8 | 1 | base2-8 1.559 | base4-14 1.512 | 0.047 |
| find | full both | 14 | base1-10 | 244 | ecard2-95a 1.562 | ecard2-95b 1.517 | 0.045 |
| find | full both | 15 | basep-46 | 207 | ecard2-H27 1.514 | ecard2-95a 1.514 | 0.000 |
| find | art both | 1 | me02-040 | 1 | me02-040 1.797 | sm6-85 1.618 | 0.179 |
| find | art both | 2 | me02-088 | 1 | me02-088 1.825 | pl1-111 1.513 | 0.312 |
| find | art both | 3 | me02-081 | 1 | me02-081 1.829 | S8-059 1.558 | 0.271 |
| find | art both | 4 | me02-049 | 1 | me02-049 1.860 | 30th-051 1.627 | 0.233 |
| find | art both | 5 | me02-057 | 1 | me02-057 1.813 | S10D-050 1.449 | 0.364 |
| find | art both | 7 | me02-032 | 2 | sm12-154 1.616 | me02-032 1.613 | 0.003 |
| find | art both | 9 | me02-048 | 1 | me02-048 1.743 | SVDs-002 1.493 | 0.250 |
| find | art both | 10 | me02-038 | 1 | me02-038 1.818 | SV4K-057 1.509 | 0.309 |
| find | art both | 11 | me02-091 | 1 | me02-091 1.812 | M4-105 1.513 | 0.299 |
| find | art both | 13 | base2-8 | 3 | lc-33 1.706 | base2-24 1.640 | 0.065 |
| find | art both | 14 | base1-10 | 1 | base1-10 1.552 | basep-3 1.439 | 0.113 |
| find | art both | 15 | basep-46 | 1 | basep-46 1.638 | neo1-22 1.347 | 0.291 |
| find | full+art | 1 | me02-040 | 1 | me02-040 3.426 | SM10-062 3.168 | 0.257 |
| find | full+art | 2 | me02-088 | 1 | me02-088 3.507 | pl1-111 2.886 | 0.621 |
| find | full+art | 3 | me02-081 | 1 | me02-081 3.515 | S8-059 3.051 | 0.464 |
| find | full+art | 4 | me02-049 | 1 | me02-049 3.553 | 30th-051 3.111 | 0.442 |
| find | full+art | 5 | me02-057 | 1 | me02-057 3.500 | sv01-132 2.997 | 0.502 |
| find | full+art | 7 | me02-032 | 2 | sm12-154 3.152 | me02-032 3.135 | 0.017 |
| find | full+art | 9 | me02-048 | 1 | me02-048 3.384 | sm5-47 2.993 | 0.391 |
| find | full+art | 10 | me02-038 | 1 | me02-038 3.426 | S4a-114 3.002 | 0.424 |
| find | full+art | 11 | me02-091 | 1 | me02-091 3.505 | M4-105 3.026 | 0.478 |
| find | full+art | 13 | base2-8 | 1 | base2-8 3.170 | lc-33 3.140 | 0.030 |
| find | full+art | 14 | base1-10 | 1 | base1-10 2.908 | basep-3 2.861 | 0.046 |
| find | full+art | 15 | basep-46 | 1 | basep-46 2.986 | ecard2-95b 2.789 | 0.197 |
| find | dhash full | 1 | me02-040 | 1 | me02-040 -26.000 | SV5M-032 -62.000 | 36.000 |
| find | dhash full | 2 | me02-088 | 1 | me02-088 -29.000 | sv08.5-108 -51.000 | 22.000 |
| find | dhash full | 3 | me02-081 | 1 | me02-081 -29.000 | sv04-142 -56.000 | 27.000 |
| find | dhash full | 4 | me02-049 | 1 | me02-049 -33.000 | sv10.5b-050 -55.000 | 22.000 |
| find | dhash full | 5 | me02-057 | 1 | me02-057 -27.000 | me06-062 -60.000 | 33.000 |
| find | dhash full | 7 | me02-032 | 599 | sv04.5-203 -77.000 | sv04.5-140 -82.000 | 5.000 |
| find | dhash full | 9 | me02-048 | 1 | me02-048 -44.000 | sv07-081 -62.000 | 18.000 |
| find | dhash full | 10 | me02-038 | 1 | me02-038 -29.000 | me02.5-098 -59.000 | 30.000 |
| find | dhash full | 11 | me02-091 | 1 | me02-091 -61.000 | SV7s-159 -70.000 | 9.000 |
| find | dhash full | 13 | base2-8 | 5034 | lc-33 -80.000 | lc-27 -87.000 | 7.000 |
| find | dhash full | 14 | base1-10 | 4 | base4-10 -50.000 | xy12-51 -50.000 | 0.000 |
| find | dhash full | 15 | basep-46 | 1 | basep-46 -59.000 | neo1-1 -76.000 | 17.000 |
| find | dhash art | 1 | me02-040 | 1 | me02-040 -27.000 | sm7-113 -85.000 | 58.000 |
| find | dhash art | 2 | me02-088 | 1 | me02-088 -30.000 | bw1-102 -78.000 | 48.000 |
| find | dhash art | 3 | me02-081 | 1 | me02-081 -46.000 | S8-087 -84.000 | 38.000 |
| find | dhash art | 4 | me02-049 | 1 | me02-049 -49.000 | SM6b-071 -86.000 | 37.000 |
| find | dhash art | 5 | me02-057 | 1 | me02-057 -43.000 | SV2a-002 -91.000 | 48.000 |
| find | dhash art | 7 | me02-032 | 141 | bw1-42 -90.000 | gym2-33 -92.000 | 2.000 |
| find | dhash art | 9 | me02-048 | 1 | me02-048 -30.000 | xy8-105 -85.000 | 55.000 |
| find | dhash art | 10 | me02-038 | 1 | me02-038 -29.000 | SV9s-035 -85.000 | 56.000 |
| find | dhash art | 11 | me02-091 | 1 | me02-091 -58.000 | swsh7-210 -86.000 | 28.000 |
| find | dhash art | 13 | base2-8 | 1769 | lc-33 -70.000 | base2-24 -72.000 | 2.000 |
| find | dhash art | 14 | base1-10 | 3 | base4-10 -61.000 | xy12-51 -69.000 | 8.000 |
| find | dhash art | 15 | basep-46 | 1 | basep-46 -55.000 | gym2-86 -75.000 | 20.000 |
| trim | full cls | 1 | me02-040 | 1 | me02-040 0.791 | ex2-38 0.783 | 0.007 |
| trim | full cls | 2 | me02-088 | 1 | me02-088 0.727 | ecard3-140 0.630 | 0.097 |
| trim | full cls | 3 | me02-081 | 1 | me02-081 0.782 | S8-059 0.657 | 0.125 |
| trim | full cls | 4 | me02-049 | 4 | S8-037 0.774 | S12a-044 0.741 | 0.033 |
| trim | full cls | 5 | me02-057 | 1 | me02-057 0.780 | S11-069 0.710 | 0.070 |
| trim | full cls | 7 | me02-032 | 16 | smp-SM110 0.772 | ex2-38 0.766 | 0.005 |
| trim | full cls | 9 | me02-048 | 1 | me02-048 0.748 | SM5M-019 0.713 | 0.035 |
| trim | full cls | 10 | me02-038 | 1 | me02-038 0.737 | ex11-53 0.685 | 0.051 |
| trim | full cls | 11 | me02-091 | 1 | me02-091 0.854 | M4-105 0.771 | 0.083 |
| trim | full cls | 13 | base2-8 | 1 | base2-8 0.755 | base4-14 0.734 | 0.021 |
| trim | full cls | 14 | base1-10 | 204 | ecard2-95a 0.705 | CP6-049 0.683 | 0.022 |
| trim | full cls | 15 | basep-46 | 482 | ecard2-95a 0.670 | smp-SM109 0.662 | 0.008 |
| trim | full mean | 1 | me02-040 | 104 | ecard2-95a 0.888 | ecard2-95b 0.881 | 0.006 |
| trim | full mean | 2 | me02-088 | 6 | dp5-91 0.819 | dp5-84 0.818 | 0.001 |
| trim | full mean | 3 | me02-081 | 475 | base1-5 0.805 | neo2-65 0.804 | 0.000 |
| trim | full mean | 4 | me02-049 | 1476 | S8-037 0.848 | ecard2-95a 0.842 | 0.006 |
| trim | full mean | 5 | me02-057 | 136 | S12a-088 0.818 | ecard2-95a 0.805 | 0.013 |
| trim | full mean | 7 | me02-032 | 800 | ecard2-95b 0.872 | ecard2-95a 0.862 | 0.010 |
| trim | full mean | 9 | me02-048 | 3487 | sv04-061 0.848 | ecard2-95a 0.846 | 0.001 |
| trim | full mean | 10 | me02-038 | 4112 | gym1-3 0.854 | ecard2-95a 0.852 | 0.002 |
| trim | full mean | 11 | me02-091 | 13 | ex3-2 0.826 | S12a-132 0.814 | 0.012 |
| trim | full mean | 13 | base2-8 | 19 | ecard2-H27 0.848 | ecard2-103b 0.846 | 0.002 |
| trim | full mean | 14 | base1-10 | 919 | ecard2-95a 0.857 | ecard2-95b 0.848 | 0.009 |
| trim | full mean | 15 | basep-46 | 174 | ecard2-H27 0.856 | ecard2-103b 0.853 | 0.003 |
| trim | full both | 1 | me02-040 | 6 | ecard3-67 1.645 | ex2-38 1.637 | 0.008 |
| trim | full both | 2 | me02-088 | 1 | me02-088 1.526 | ecard3-132 1.426 | 0.101 |
| trim | full both | 3 | me02-081 | 1 | me02-081 1.530 | SDL-005 1.414 | 0.116 |
| trim | full both | 4 | me02-049 | 4 | S8-037 1.622 | S12a-044 1.576 | 0.046 |
| trim | full both | 5 | me02-057 | 1 | me02-057 1.551 | S6a-053 1.495 | 0.056 |
| trim | full both | 7 | me02-032 | 80 | smp-SM110 1.613 | ecard2-95a 1.610 | 0.002 |
| trim | full both | 9 | me02-048 | 2 | pl4-SH12 1.539 | me02-048 1.525 | 0.014 |
| trim | full both | 10 | me02-038 | 1 | me02-038 1.526 | SV9-020 1.513 | 0.013 |
| trim | full both | 11 | me02-091 | 1 | me02-091 1.655 | M4-105 1.554 | 0.101 |
| trim | full both | 13 | base2-8 | 1 | base2-8 1.559 | base4-14 1.512 | 0.047 |
| trim | full both | 14 | base1-10 | 244 | ecard2-95a 1.562 | ecard2-95b 1.517 | 0.045 |
| trim | full both | 15 | basep-46 | 207 | ecard2-H27 1.514 | ecard2-95a 1.514 | 0.000 |
| trim | art both | 1 | me02-040 | 1 | me02-040 1.754 | sm6-85 1.594 | 0.159 |
| trim | art both | 2 | me02-088 | 1 | me02-088 1.817 | pl1-111 1.532 | 0.285 |
| trim | art both | 3 | me02-081 | 1 | me02-081 1.625 | S8-059 1.456 | 0.169 |
| trim | art both | 4 | me02-049 | 1 | me02-049 1.745 | neo4-67 1.609 | 0.135 |
| trim | art both | 5 | me02-057 | 1 | me02-057 1.574 | xy9-51 1.457 | 0.117 |
| trim | art both | 7 | me02-032 | 2 | sm12-154 1.616 | me02-032 1.613 | 0.003 |
| trim | art both | 9 | me02-048 | 1 | me02-048 1.608 | SM5M-019 1.467 | 0.141 |
| trim | art both | 10 | me02-038 | 1 | me02-038 1.777 | SM12a-031 1.526 | 0.251 |
| trim | art both | 11 | me02-091 | 1 | me02-091 1.724 | M4-105 1.490 | 0.234 |
| trim | art both | 13 | base2-8 | 3 | lc-33 1.706 | base2-24 1.640 | 0.065 |
| trim | art both | 14 | base1-10 | 1 | base1-10 1.552 | basep-3 1.439 | 0.113 |
| trim | art both | 15 | basep-46 | 1 | basep-46 1.638 | neo1-22 1.347 | 0.291 |
| trim | full+art | 1 | me02-040 | 1 | me02-040 3.374 | sm6-85 3.182 | 0.191 |
| trim | full+art | 2 | me02-088 | 1 | me02-088 3.343 | pl1-111 2.851 | 0.492 |
| trim | full+art | 3 | me02-081 | 1 | me02-081 3.155 | S8-059 2.806 | 0.349 |
| trim | full+art | 4 | me02-049 | 1 | me02-049 3.265 | S12a-044 3.143 | 0.123 |
| trim | full+art | 5 | me02-057 | 1 | me02-057 3.125 | S6a-053 2.861 | 0.265 |
| trim | full+art | 7 | me02-032 | 2 | sm12-154 3.152 | me02-032 3.135 | 0.017 |
| trim | full+art | 9 | me02-048 | 1 | me02-048 3.133 | SM5M-019 2.982 | 0.151 |
| trim | full+art | 10 | me02-038 | 1 | me02-038 3.303 | SM9-041 3.008 | 0.294 |
| trim | full+art | 11 | me02-091 | 1 | me02-091 3.379 | M4-105 3.044 | 0.335 |
| trim | full+art | 13 | base2-8 | 1 | base2-8 3.170 | lc-33 3.140 | 0.030 |
| trim | full+art | 14 | base1-10 | 1 | base1-10 2.908 | basep-3 2.861 | 0.046 |
| trim | full+art | 15 | basep-46 | 1 | basep-46 2.986 | ecard2-95b 2.789 | 0.197 |
| trim | dhash full | 1 | me02-040 | 1 | me02-040 -75.000 | SV8s-082 -89.000 | 14.000 |
| trim | dhash full | 2 | me02-088 | 1 | me02-088 -42.000 | me01-114 -61.000 | 19.000 |
| trim | dhash full | 3 | me02-081 | 1 | me02-081 -78.000 | sv04.5-210 -79.000 | 1.000 |
| trim | dhash full | 4 | me02-049 | 1 | me02-049 -84.000 | sv04-167 -86.000 | 2.000 |
| trim | dhash full | 5 | me02-057 | 3 | sv02-141 -77.000 | sv04.5-062 -78.000 | 1.000 |
| trim | dhash full | 7 | me02-032 | 599 | sv04.5-203 -77.000 | sv04.5-140 -82.000 | 5.000 |
| trim | dhash full | 9 | me02-048 | 63 | swsh7-48 -85.000 | svp-096 -87.000 | 2.000 |
| trim | dhash full | 10 | me02-038 | 1 | me02-038 -75.000 | bw8-33 -79.000 | 4.000 |
| trim | dhash full | 11 | me02-091 | 4 | me05-074 -63.000 | me05-080 -66.000 | 3.000 |
| trim | dhash full | 13 | base2-8 | 5034 | lc-33 -80.000 | lc-27 -87.000 | 7.000 |
| trim | dhash full | 14 | base1-10 | 4 | base4-10 -50.000 | xy12-51 -50.000 | 0.000 |
| trim | dhash full | 15 | basep-46 | 1 | basep-46 -59.000 | neo1-1 -76.000 | 17.000 |
| trim | dhash art | 1 | me02-040 | 1 | me02-040 -63.000 | swsh11-083 -80.000 | 17.000 |
| trim | dhash art | 2 | me02-088 | 1 | me02-088 -42.000 | bw1-102 -82.000 | 40.000 |
| trim | dhash art | 3 | me02-081 | 1 | me02-081 -80.000 | hgss3-24 -81.000 | 1.000 |
| trim | dhash art | 4 | me02-049 | 76 | SV10-118 -88.000 | sv04.5-147 -89.000 | 1.000 |
| trim | dhash art | 5 | me02-057 | 33 | S5I-008 -93.000 | ecard3-124 -94.000 | 1.000 |
| trim | dhash art | 7 | me02-032 | 141 | bw1-42 -90.000 | gym2-33 -92.000 | 2.000 |
| trim | dhash art | 9 | me02-048 | 27 | sm5-28 -86.000 | swsh4.5-12 -87.000 | 1.000 |
| trim | dhash art | 10 | me02-038 | 3 | mep-064 -88.000 | me04-093 -88.000 | 0.000 |
| trim | dhash art | 11 | me02-091 | 1 | me02-091 -86.000 | SM4A-011 -88.000 | 2.000 |
| trim | dhash art | 13 | base2-8 | 1769 | lc-33 -70.000 | base2-24 -72.000 | 2.000 |
| trim | dhash art | 14 | base1-10 | 3 | base4-10 -61.000 | xy12-51 -69.000 | 8.000 |
| trim | dhash art | 15 | basep-46 | 1 | basep-46 -55.000 | gym2-86 -75.000 | 20.000 |
