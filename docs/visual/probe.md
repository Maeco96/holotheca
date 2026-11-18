# Visual index probe

Index: 30943 cards (dinov2s-int8.onnx, built 2026-11-18T09:52:24Z); 19647 cards without an image. Photos: 14.

Packed for the phone (int8):

| cut | parts | dims | size | top-1 | top-5 | ranks |
|---|---|---|---|---|---|---|
| find | full | 768 | 23.9 MB | 8/12 | 8/12 | 8, 1, 1, 1, 1, 95, 1, 1, 1, 1, 146, 802 |
| trim | full | 768 | 23.9 MB | 7/12 | 8/12 | 8, 1, 1, 5, 1, 95, 1, 1, 1, 1, 146, 802 |
| find | full | 384 | 12.0 MB | 8/12 | 8/12 | 27, 1, 1, 1, 1, 304, 1, 1, 1, 1, 107, 62 |
| trim | full | 384 | 12.0 MB | 5/12 | 5/12 | 58, 1, 1, 75, 1, 304, 21, 17, 1, 1, 107, 62 |
| find | full | 256 | 8.0 MB | 8/12 | 8/12 | 44, 1, 1, 1, 1, 376, 1, 1, 1, 1, 106, 63 |
| trim | full | 256 | 8.0 MB | 5/12 | 5/12 | 70, 1, 1, 93, 1, 376, 27, 29, 1, 1, 106, 63 |
| find | full | 128 | 4.1 MB | 6/12 | 6/12 | 110, 1, 1, 1, 1, 575, 7, 8, 1, 1, 106, 73 |
| trim | full | 128 | 4.1 MB | 3/12 | 5/12 | 131, 1, 1, 268, 2, 575, 41, 72, 2, 1, 106, 73 |
| find | art | 768 | 23.9 MB | 11/12 | 12/12 | 1, 1, 1, 1, 1, 1, 1, 1, 1, 3, 1, 1 |
| trim | art | 768 | 23.9 MB | 11/12 | 12/12 | 1, 1, 1, 1, 1, 1, 1, 1, 1, 3, 1, 1 |
| find | art | 384 | 12.0 MB | 11/12 | 12/12 | 1, 1, 1, 1, 1, 1, 1, 1, 1, 3, 1, 1 |
| trim | art | 384 | 12.0 MB | 11/12 | 12/12 | 1, 1, 1, 1, 1, 1, 1, 1, 1, 3, 1, 1 |
| find | art | 256 | 8.0 MB | 10/12 | 12/12 | 1, 1, 1, 1, 1, 2, 1, 1, 1, 3, 1, 1 |
| trim | art | 256 | 8.0 MB | 10/12 | 12/12 | 1, 1, 1, 1, 1, 2, 1, 1, 1, 3, 1, 1 |
| find | art | 128 | 4.1 MB | 10/12 | 12/12 | 1, 1, 1, 1, 1, 5, 1, 1, 1, 3, 1, 1 |
| trim | art | 128 | 4.1 MB | 10/12 | 12/12 | 1, 1, 1, 1, 1, 5, 1, 1, 1, 3, 1, 1 |
| find | full+art | 1536 | 47.7 MB | 12/12 | 12/12 | 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1 |
| trim | full+art | 1536 | 47.7 MB | 12/12 | 12/12 | 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1 |
| find | full+art | 384 | 12.0 MB | 10/12 | 11/12 | 1, 1, 1, 1, 1, 17, 1, 1, 1, 3, 1, 1 |
| trim | full+art | 384 | 12.0 MB | 10/12 | 11/12 | 1, 1, 1, 1, 1, 17, 1, 1, 1, 3, 1, 1 |
| find | full+art | 256 | 8.0 MB | 10/12 | 11/12 | 1, 1, 1, 1, 1, 21, 1, 1, 1, 3, 1, 1 |
| trim | full+art | 256 | 8.0 MB | 10/12 | 11/12 | 1, 1, 1, 1, 1, 21, 1, 1, 1, 3, 1, 1 |
| find | full+art | 128 | 4.1 MB | 10/12 | 11/12 | 1, 1, 1, 1, 1, 28, 1, 1, 1, 2, 1, 1 |
| trim | full+art | 128 | 4.1 MB | 9/12 | 11/12 | 1, 1, 1, 2, 1, 28, 1, 1, 1, 2, 1, 1 |

| cut | compare | top-1 | top-5 | top-20 | ranks |
|---|---|---|---|---|---|
| find | full cls | 8/12 | 8/12 | 10/12 | 6, 1, 1, 1, 1, None, 20, None, 1, 1, 1, 1, 106, 1844 |
| find | full mean | 3/12 | 4/12 | 5/12 | 87, 1, 1, 32, 5, None, 1084, None, 46, 947, 1, 16, 657, 522 |
| find | full both | 8/12 | 8/12 | 9/12 | 9, 1, 1, 1, 1, None, 99, None, 1, 1, 1, 1, 148, 770 |
| find | art both | 11/12 | 12/12 | 12/12 | 1, 1, 1, 1, 1, None, 1, None, 1, 1, 1, 3, 1, 1 |
| find | full+art | 12/12 | 12/12 | 12/12 | 1, 1, 1, 1, 1, None, 1, None, 1, 1, 1, 1, 1, 1 |
| find | dhash full | 9/12 | 10/12 | 10/12 | 1, 1, 1, 1, 1, None, 599, None, 1, 1, 1, 5043, 4, 1 |
| find | dhash art | 9/12 | 10/12 | 10/12 | 1, 1, 1, 1, 1, None, 144, None, 1, 1, 1, 1778, 3, 1 |
| trim | full cls | 8/12 | 9/12 | 10/12 | 1, 1, 1, 4, 1, None, 20, None, 1, 1, 1, 1, 106, 1844 |
| trim | full mean | 0/12 | 0/12 | 3/12 | 259, 8, 278, 4192, 64, None, 1084, None, 1765, 3852, 7, 16, 657, 522 |
| trim | full both | 7/12 | 8/12 | 9/12 | 9, 1, 1, 5, 1, None, 99, None, 1, 1, 1, 1, 148, 770 |
| trim | art both | 11/12 | 12/12 | 12/12 | 1, 1, 1, 1, 1, None, 1, None, 1, 1, 1, 3, 1, 1 |
| trim | full+art | 12/12 | 12/12 | 12/12 | 1, 1, 1, 1, 1, None, 1, None, 1, 1, 1, 1, 1, 1 |
| trim | dhash full | 6/12 | 9/12 | 9/12 | 1, 1, 1, 1, 3, None, 599, None, 63, 1, 4, 5043, 4, 1 |
| trim | dhash art | 5/12 | 7/12 | 7/12 | 1, 1, 1, 76, 33, None, 144, None, 27, 3, 1, 1778, 3, 1 |

| cut | compare | photo | right card | rank | first | second | gap |
|---|---|---|---|---|---|---|---|
| find | full cls | 1 | me02-040 | 6 | mep-069 0.762 | S10P-027 0.762 | 0.000 |
| find | full cls | 2 | me02-088 | 1 | me02-088 0.836 | me02.5-197 0.696 | 0.140 |
| find | full cls | 3 | me02-081 | 1 | me02-081 0.834 | S8-059 0.700 | 0.133 |
| find | full cls | 4 | me02-049 | 1 | me02-049 0.810 | neo4-67 0.744 | 0.065 |
| find | full cls | 5 | me02-057 | 1 | me02-057 0.841 | sv01-132 0.758 | 0.083 |
| find | full cls | 7 | me02-032 | 20 | smp-SM110 0.779 | smp-SM109 0.770 | 0.009 |
| find | full cls | 9 | me02-048 | 1 | me02-048 0.800 | sv07-078 0.743 | 0.057 |
| find | full cls | 10 | me02-038 | 1 | me02-038 0.796 | S12-045 0.736 | 0.060 |
| find | full cls | 11 | me02-091 | 1 | me02-091 0.845 | M4-105 0.765 | 0.080 |
| find | full cls | 13 | base2-8 | 1 | base2-8 0.745 | base4-14 0.726 | 0.019 |
| find | full cls | 14 | base1-10 | 106 | ecard2-95a 0.697 | SM5M-020 0.687 | 0.009 |
| find | full cls | 15 | basep-46 | 1844 | ecard2-H27 0.689 | smp-SM110 0.671 | 0.018 |
| find | full mean | 1 | me02-040 | 87 | SV10-041 0.875 | S10P-027 0.863 | 0.012 |
| find | full mean | 2 | me02-088 | 1 | me02-088 0.864 | me02.5-197 0.843 | 0.021 |
| find | full mean | 3 | me02-081 | 1 | me02-081 0.859 | mep-069 0.833 | 0.025 |
| find | full mean | 4 | me02-049 | 32 | sv05-058 0.877 | SV7s-029 0.875 | 0.001 |
| find | full mean | 5 | me02-057 | 5 | sv01-133 0.874 | SV1S-057 0.869 | 0.004 |
| find | full mean | 7 | me02-032 | 1084 | ecard2-95b 0.874 | ecard2-95a 0.861 | 0.013 |
| find | full mean | 9 | me02-048 | 46 | sv06-074 0.878 | sv01-043 0.875 | 0.003 |
| find | full mean | 10 | me02-038 | 947 | S12-045 0.872 | S3a-006 0.866 | 0.006 |
| find | full mean | 11 | me02-091 | 1 | me02-091 0.849 | me02.5-198 0.845 | 0.004 |
| find | full mean | 13 | base2-8 | 16 | ecard2-H27 0.855 | ecard2-103b 0.851 | 0.004 |
| find | full mean | 14 | base1-10 | 657 | ecard2-95a 0.853 | ecard2-95b 0.848 | 0.006 |
| find | full mean | 15 | basep-46 | 522 | ecard2-H27 0.858 | ecard2-103b 0.850 | 0.008 |
| find | full both | 1 | me02-040 | 9 | SV10-041 1.635 | S10P-027 1.624 | 0.010 |
| find | full both | 2 | me02-088 | 1 | me02-088 1.700 | me02.5-197 1.539 | 0.161 |
| find | full both | 3 | me02-081 | 1 | me02-081 1.692 | S8-059 1.493 | 0.199 |
| find | full both | 4 | me02-049 | 1 | me02-049 1.672 | me04-020 1.602 | 0.070 |
| find | full both | 5 | me02-057 | 1 | me02-057 1.707 | SV9s-085 1.627 | 0.081 |
| find | full both | 7 | me02-032 | 99 | smp-SM110 1.622 | smp-SM109 1.613 | 0.008 |
| find | full both | 9 | me02-048 | 1 | me02-048 1.656 | sv07-078 1.603 | 0.054 |
| find | full both | 10 | me02-038 | 1 | me02-038 1.622 | S12-045 1.608 | 0.014 |
| find | full both | 11 | me02-091 | 1 | me02-091 1.694 | M4-105 1.502 | 0.192 |
| find | full both | 13 | base2-8 | 1 | base2-8 1.552 | base4-14 1.499 | 0.053 |
| find | full both | 14 | base1-10 | 148 | ecard2-95a 1.550 | ecard2-95b 1.503 | 0.047 |
| find | full both | 15 | basep-46 | 770 | ecard2-H27 1.546 | ecard2-95a 1.511 | 0.035 |
| find | art both | 1 | me02-040 | 1 | me02-040 1.799 | sm6-85 1.644 | 0.155 |
| find | art both | 2 | me02-088 | 1 | me02-088 1.813 | pl1-111 1.499 | 0.314 |
| find | art both | 3 | me02-081 | 1 | me02-081 1.812 | swsh8-159 1.568 | 0.243 |
| find | art both | 4 | me02-049 | 1 | me02-049 1.859 | sv10-128 1.646 | 0.213 |
| find | art both | 5 | me02-057 | 1 | me02-057 1.787 | S10D-050 1.457 | 0.330 |
| find | art both | 7 | me02-032 | 1 | me02-032 1.627 | sm12-154 1.594 | 0.033 |
| find | art both | 9 | me02-048 | 1 | me02-048 1.737 | SVDs-002 1.482 | 0.255 |
| find | art both | 10 | me02-038 | 1 | me02-038 1.811 | SM12a-031 1.508 | 0.303 |
| find | art both | 11 | me02-091 | 1 | me02-091 1.785 | M4-105 1.498 | 0.287 |
| find | art both | 13 | base2-8 | 3 | lc-33 1.719 | base2-24 1.660 | 0.058 |
| find | art both | 14 | base1-10 | 1 | base1-10 1.567 | basep-8 1.458 | 0.109 |
| find | art both | 15 | basep-46 | 1 | basep-46 1.640 | neo1-22 1.356 | 0.284 |
| find | full+art | 1 | me02-040 | 1 | me02-040 3.397 | sm6-85 3.188 | 0.209 |
| find | full+art | 2 | me02-088 | 1 | me02-088 3.513 | pl1-111 2.890 | 0.623 |
| find | full+art | 3 | me02-081 | 1 | me02-081 3.504 | S8-059 3.051 | 0.453 |
| find | full+art | 4 | me02-049 | 1 | me02-049 3.531 | 30th-051 3.113 | 0.418 |
| find | full+art | 5 | me02-057 | 1 | me02-057 3.495 | SV1S-056 2.978 | 0.517 |
| find | full+art | 7 | me02-032 | 1 | me02-032 3.141 | pl2-85 3.134 | 0.007 |
| find | full+art | 9 | me02-048 | 1 | me02-048 3.393 | SV1V-031 2.982 | 0.411 |
| find | full+art | 10 | me02-038 | 1 | me02-038 3.433 | SM12a-031 3.018 | 0.415 |
| find | full+art | 11 | me02-091 | 1 | me02-091 3.480 | M4-105 3.001 | 0.479 |
| find | full+art | 13 | base2-8 | 1 | base2-8 3.149 | lc-33 3.130 | 0.020 |
| find | full+art | 14 | base1-10 | 1 | base1-10 2.941 | basep-8 2.889 | 0.051 |
| find | full+art | 15 | basep-46 | 1 | basep-46 2.928 | neo1-22 2.788 | 0.140 |
| find | dhash full | 1 | me02-040 | 1 | me02-040 -26.000 | SV5M-032 -62.000 | 36.000 |
| find | dhash full | 2 | me02-088 | 1 | me02-088 -29.000 | sv08.5-108 -51.000 | 22.000 |
| find | dhash full | 3 | me02-081 | 1 | me02-081 -29.000 | sv04-142 -56.000 | 27.000 |
| find | dhash full | 4 | me02-049 | 1 | me02-049 -33.000 | sv10.5b-050 -55.000 | 22.000 |
| find | dhash full | 5 | me02-057 | 1 | me02-057 -27.000 | me06-062 -60.000 | 33.000 |
| find | dhash full | 7 | me02-032 | 599 | sv04.5-203 -77.000 | sv04.5-140 -82.000 | 5.000 |
| find | dhash full | 9 | me02-048 | 1 | me02-048 -44.000 | sv07-081 -62.000 | 18.000 |
| find | dhash full | 10 | me02-038 | 1 | me02-038 -29.000 | me02.5-098 -59.000 | 30.000 |
| find | dhash full | 11 | me02-091 | 1 | me02-091 -61.000 | me02.5-188 -70.000 | 9.000 |
| find | dhash full | 13 | base2-8 | 5043 | lc-33 -80.000 | lc-27 -87.000 | 7.000 |
| find | dhash full | 14 | base1-10 | 4 | base4-10 -50.000 | xy12-51 -50.000 | 0.000 |
| find | dhash full | 15 | basep-46 | 1 | basep-46 -59.000 | neo1-1 -76.000 | 17.000 |
| find | dhash art | 1 | me02-040 | 1 | me02-040 -27.000 | sm7-113 -85.000 | 58.000 |
| find | dhash art | 2 | me02-088 | 1 | me02-088 -30.000 | bw1-102 -78.000 | 48.000 |
| find | dhash art | 3 | me02-081 | 1 | me02-081 -46.000 | S8-087 -84.000 | 38.000 |
| find | dhash art | 4 | me02-049 | 1 | me02-049 -49.000 | SM6b-071 -86.000 | 37.000 |
| find | dhash art | 5 | me02-057 | 1 | me02-057 -43.000 | SV2a-002 -91.000 | 48.000 |
| find | dhash art | 7 | me02-032 | 144 | bw1-42 -90.000 | gym2-33 -92.000 | 2.000 |
| find | dhash art | 9 | me02-048 | 1 | me02-048 -30.000 | xy8-105 -85.000 | 55.000 |
| find | dhash art | 10 | me02-038 | 1 | me02-038 -29.000 | SV9s-035 -85.000 | 56.000 |
| find | dhash art | 11 | me02-091 | 1 | me02-091 -58.000 | swsh7-210 -86.000 | 28.000 |
| find | dhash art | 13 | base2-8 | 1778 | lc-33 -70.000 | base2-24 -72.000 | 2.000 |
| find | dhash art | 14 | base1-10 | 3 | base4-10 -61.000 | xy12-51 -69.000 | 8.000 |
| find | dhash art | 15 | basep-46 | 1 | basep-46 -55.000 | gym2-86 -75.000 | 20.000 |
| trim | full cls | 1 | me02-040 | 1 | me02-040 0.782 | ex2-38 0.781 | 0.001 |
| trim | full cls | 2 | me02-088 | 1 | me02-088 0.744 | sm6-17 0.625 | 0.119 |
| trim | full cls | 3 | me02-081 | 1 | me02-081 0.786 | S8-059 0.657 | 0.129 |
| trim | full cls | 4 | me02-049 | 4 | S8-037 0.774 | S12a-044 0.759 | 0.015 |
| trim | full cls | 5 | me02-057 | 1 | me02-057 0.793 | S11-069 0.710 | 0.083 |
| trim | full cls | 7 | me02-032 | 20 | smp-SM110 0.779 | smp-SM109 0.770 | 0.009 |
| trim | full cls | 9 | me02-048 | 1 | me02-048 0.761 | SM5M-019 0.714 | 0.047 |
| trim | full cls | 10 | me02-038 | 1 | me02-038 0.743 | SV9-020 0.682 | 0.062 |
| trim | full cls | 11 | me02-091 | 1 | me02-091 0.843 | M4-105 0.771 | 0.072 |
| trim | full cls | 13 | base2-8 | 1 | base2-8 0.745 | base4-14 0.726 | 0.019 |
| trim | full cls | 14 | base1-10 | 106 | ecard2-95a 0.697 | SM5M-020 0.687 | 0.009 |
| trim | full cls | 15 | basep-46 | 1844 | ecard2-H27 0.689 | smp-SM110 0.671 | 0.018 |
| trim | full mean | 1 | me02-040 | 259 | ecard2-95a 0.889 | ecard2-95b 0.881 | 0.008 |
| trim | full mean | 2 | me02-088 | 8 | dp5-84 0.820 | dp6-139 0.815 | 0.005 |
| trim | full mean | 3 | me02-081 | 278 | base1-27 0.806 | ex6-48 0.803 | 0.003 |
| trim | full mean | 4 | me02-049 | 4192 | ecard2-74b 0.850 | S8-037 0.848 | 0.002 |
| trim | full mean | 5 | me02-057 | 64 | S12a-088 0.818 | ecard2-95a 0.807 | 0.011 |
| trim | full mean | 7 | me02-032 | 1084 | ecard2-95b 0.874 | ecard2-95a 0.861 | 0.013 |
| trim | full mean | 9 | me02-048 | 1765 | gym1-3 0.850 | ecard2-95b 0.846 | 0.004 |
| trim | full mean | 10 | me02-038 | 3852 | gym1-3 0.854 | S11-048 0.852 | 0.003 |
| trim | full mean | 11 | me02-091 | 7 | ex3-2 0.821 | ecard1-143 0.818 | 0.002 |
| trim | full mean | 13 | base2-8 | 16 | ecard2-H27 0.855 | ecard2-103b 0.851 | 0.004 |
| trim | full mean | 14 | base1-10 | 657 | ecard2-95a 0.853 | ecard2-95b 0.848 | 0.006 |
| trim | full mean | 15 | basep-46 | 522 | ecard2-H27 0.858 | ecard2-103b 0.850 | 0.008 |
| trim | full both | 1 | me02-040 | 9 | ecard2-74b 1.634 | ex2-38 1.631 | 0.003 |
| trim | full both | 2 | me02-088 | 1 | me02-088 1.541 | ecard3-132 1.416 | 0.126 |
| trim | full both | 3 | me02-081 | 1 | me02-081 1.542 | SDL-005 1.416 | 0.126 |
| trim | full both | 4 | me02-049 | 5 | S8-037 1.622 | S12a-044 1.587 | 0.035 |
| trim | full both | 5 | me02-057 | 1 | me02-057 1.572 | S6a-053 1.495 | 0.077 |
| trim | full both | 7 | me02-032 | 99 | smp-SM110 1.622 | smp-SM109 1.613 | 0.008 |
| trim | full both | 9 | me02-048 | 1 | me02-048 1.550 | pl4-SH12 1.537 | 0.013 |
| trim | full both | 10 | me02-038 | 1 | me02-038 1.534 | SV9-020 1.519 | 0.016 |
| trim | full both | 11 | me02-091 | 1 | me02-091 1.647 | M4-105 1.554 | 0.094 |
| trim | full both | 13 | base2-8 | 1 | base2-8 1.552 | base4-14 1.499 | 0.053 |
| trim | full both | 14 | base1-10 | 148 | ecard2-95a 1.550 | ecard2-95b 1.503 | 0.047 |
| trim | full both | 15 | basep-46 | 770 | ecard2-H27 1.546 | ecard2-95a 1.511 | 0.035 |
| trim | art both | 1 | me02-040 | 1 | me02-040 1.751 | sm6-85 1.611 | 0.140 |
| trim | art both | 2 | me02-088 | 1 | me02-088 1.810 | pl1-111 1.529 | 0.281 |
| trim | art both | 3 | me02-081 | 1 | me02-081 1.604 | S8-059 1.456 | 0.148 |
| trim | art both | 4 | me02-049 | 1 | me02-049 1.741 | neo4-67 1.606 | 0.135 |
| trim | art both | 5 | me02-057 | 1 | me02-057 1.564 | xy9-51 1.462 | 0.102 |
| trim | art both | 7 | me02-032 | 1 | me02-032 1.627 | sm12-154 1.594 | 0.033 |
| trim | art both | 9 | me02-048 | 1 | me02-048 1.591 | SM5M-019 1.479 | 0.112 |
| trim | art both | 10 | me02-038 | 1 | me02-038 1.776 | SM12a-031 1.556 | 0.221 |
| trim | art both | 11 | me02-091 | 1 | me02-091 1.700 | M4-105 1.483 | 0.217 |
| trim | art both | 13 | base2-8 | 3 | lc-33 1.719 | base2-24 1.660 | 0.058 |
| trim | art both | 14 | base1-10 | 1 | base1-10 1.567 | basep-8 1.458 | 0.109 |
| trim | art both | 15 | basep-46 | 1 | basep-46 1.640 | neo1-22 1.356 | 0.284 |
| trim | full+art | 1 | me02-040 | 1 | me02-040 3.352 | sm6-85 3.208 | 0.144 |
| trim | full+art | 2 | me02-088 | 1 | me02-088 3.352 | pl1-111 2.867 | 0.484 |
| trim | full+art | 3 | me02-081 | 1 | me02-081 3.147 | S8-059 2.806 | 0.340 |
| trim | full+art | 4 | me02-049 | 1 | me02-049 3.241 | S12a-044 3.132 | 0.109 |
| trim | full+art | 5 | me02-057 | 1 | me02-057 3.137 | SV1S-056 2.878 | 0.259 |
| trim | full+art | 7 | me02-032 | 1 | me02-032 3.141 | pl2-85 3.134 | 0.007 |
| trim | full+art | 9 | me02-048 | 1 | me02-048 3.141 | SM5M-019 2.992 | 0.150 |
| trim | full+art | 10 | me02-038 | 1 | me02-038 3.311 | SM12a-031 3.015 | 0.296 |
| trim | full+art | 11 | me02-091 | 1 | me02-091 3.347 | M4-105 3.037 | 0.310 |
| trim | full+art | 13 | base2-8 | 1 | base2-8 3.149 | lc-33 3.130 | 0.020 |
| trim | full+art | 14 | base1-10 | 1 | base1-10 2.941 | basep-8 2.889 | 0.051 |
| trim | full+art | 15 | basep-46 | 1 | basep-46 2.928 | neo1-22 2.788 | 0.140 |
| trim | dhash full | 1 | me02-040 | 1 | me02-040 -75.000 | me04-031 -89.000 | 14.000 |
| trim | dhash full | 2 | me02-088 | 1 | me02-088 -42.000 | me01-114 -61.000 | 19.000 |
| trim | dhash full | 3 | me02-081 | 1 | me02-081 -78.000 | sv04.5-210 -79.000 | 1.000 |
| trim | dhash full | 4 | me02-049 | 1 | me02-049 -84.000 | sv04-167 -86.000 | 2.000 |
| trim | dhash full | 5 | me02-057 | 3 | sv02-141 -77.000 | sv04.5-062 -78.000 | 1.000 |
| trim | dhash full | 7 | me02-032 | 599 | sv04.5-203 -77.000 | sv04.5-140 -82.000 | 5.000 |
| trim | dhash full | 9 | me02-048 | 63 | swsh7-48 -85.000 | sv04-250 -87.000 | 2.000 |
| trim | dhash full | 10 | me02-038 | 1 | me02-038 -75.000 | bw8-33 -79.000 | 4.000 |
| trim | dhash full | 11 | me02-091 | 4 | me05-074 -63.000 | me03-078 -66.000 | 3.000 |
| trim | dhash full | 13 | base2-8 | 5043 | lc-33 -80.000 | lc-27 -87.000 | 7.000 |
| trim | dhash full | 14 | base1-10 | 4 | base4-10 -50.000 | xy12-51 -50.000 | 0.000 |
| trim | dhash full | 15 | basep-46 | 1 | basep-46 -59.000 | neo1-1 -76.000 | 17.000 |
| trim | dhash art | 1 | me02-040 | 1 | me02-040 -63.000 | swsh11-083 -80.000 | 17.000 |
| trim | dhash art | 2 | me02-088 | 1 | me02-088 -42.000 | bw1-102 -82.000 | 40.000 |
| trim | dhash art | 3 | me02-081 | 1 | me02-081 -80.000 | hgss3-24 -81.000 | 1.000 |
| trim | dhash art | 4 | me02-049 | 76 | SV10-118 -88.000 | sv04.5-147 -89.000 | 1.000 |
| trim | dhash art | 5 | me02-057 | 33 | S5I-008 -93.000 | ecard3-124 -94.000 | 1.000 |
| trim | dhash art | 7 | me02-032 | 144 | bw1-42 -90.000 | gym2-33 -92.000 | 2.000 |
| trim | dhash art | 9 | me02-048 | 27 | sm5-28 -86.000 | swsh4.5-12 -87.000 | 1.000 |
| trim | dhash art | 10 | me02-038 | 3 | me04-093 -88.000 | mep-064 -88.000 | 0.000 |
| trim | dhash art | 11 | me02-091 | 1 | me02-091 -86.000 | SM4A-011 -88.000 | 2.000 |
| trim | dhash art | 13 | base2-8 | 1778 | lc-33 -70.000 | base2-24 -72.000 | 2.000 |
| trim | dhash art | 14 | base1-10 | 3 | base4-10 -61.000 | xy12-51 -69.000 | 8.000 |
| trim | dhash art | 15 | basep-46 | 1 | basep-46 -55.000 | gym2-86 -75.000 | 20.000 |
