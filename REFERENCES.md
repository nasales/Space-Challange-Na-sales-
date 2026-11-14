# References

## NASA data
| Dataset | Version | Link | Used for |
|---|---|---|---|

## Other data, code, libraries, models, fonts and images
| Name | License | Link | Used for |
|---|---|---|---|
| Yue, S. and Wang, C. (2002). Applicability of prewhitening to eliminate the influence of serial correlation on the Mann-Kendall test. Water Resources Research 38(6), 1068 | Scientific paper (method cited) | https://doi.org/10.1029/2001WR000861 | Pre-whitened Mann-Kendall test in `pipeline/trend.py` |
| Gilbert, R. O. (1987). Statistical Methods for Environmental Pollution Monitoring. Van Nostrand Reinhold | Book (method cited) | ISBN 978-0-442-23050-0 | Confidence interval of the Sen slope in `pipeline/trend.py` |
| pymannkendall 1.4.3 | MIT | https://github.com/mmhs013/pyMannKendall | Mann-Kendall test in `pipeline/trend.py` |
| SciPy 1.18.1 | BSD-3-Clause | https://scipy.org | Sen slope (`theilslopes`) and normal quantile in `pipeline/trend.py` |
| NumPy 2.5.4 | BSD-3-Clause | https://numpy.org | Array maths in `pipeline/` |
| pytest 9.2.0 | MIT | https://pytest.org | Tests in `pipeline/tests/` |
