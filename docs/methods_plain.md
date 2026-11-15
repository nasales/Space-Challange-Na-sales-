# How the detective checks the data

A plain-language guide for players. The technical version, with all references, is in `docs/methods.md`.

## Where the data come from
All the data in this game are **NASA Earth observation data**: satellites, and computer models
that combine satellite and ground measurements. They are public, checked by scientists and used
in climate research all over the world.

- **Temperature, wind, soil moisture and evaporation** (from 2000): NASA GLDAS.
- **Rain** (from 1998): NASA GPM IMERG, satellites calibrated with rain gauges.
- **Long temperature record** (from 1980): NASA MERRA-2.
- **Featured cases:** the same three NASA products, at the location of each case.

Spain is divided into squares of about 28 km. For each square we have one value per month.

## How a trend is checked
When you pick a place and a variable, the detective does three things:

1. **Removes the seasons.** Summer is always hotter than winter, so each month is compared with the usual value for that month. What is left is "warmer or colder than normal".
2. **Measures the change.** It looks at how fast the values go up or down over the years, for example "+0.3 °C every 10 years".
3. **Checks that it is not luck.** Weather goes up and down by chance. A statistical test (Mann-Kendall) asks: could a change this big appear by pure chance? If the answer is "very unlikely" (less than 5 in 100), the trend is called **significant**.

## How to read the result
- **Significant trend going up or down:** the data show a clear change.
- **No significant trend:** the data do not show a clear change. This is a real answer, not a failure. It does not prove that nothing changed; the change, if any, is too small to tell apart from normal ups and downs.
- **A trend is not a cause.** The data can say *that* something changed, not *why*.

## Good detectives know the limits
- Some series start in 1998 or 2000, so they cover only about 26 to 28 years.
- Each square is an average over about 28 km. A single town can be different.
- With so many squares, a few may look significant by chance. A pattern over a whole region is stronger evidence than one square.

## Data credits
Data: NASA GLDAS, NASA GPM IMERG and NASA MERRA-2.
