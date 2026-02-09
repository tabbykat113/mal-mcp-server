### Fixes

* Sometimes we return "more available, increase offset" even though we've actually scanned seemingly all available results. Visible when using filters with search, e.g. "93 results per page, more available".
* Since now there is a difference between logical limit and API limit when filtering, we could include the computed offset required for the next page of results in tool responses.
* Search tool results should include a hint to use seasonal or ranking-based tools if looking for vague concepts that keyword search might miss rather than specific anime (since the search is very fuzzy).