# Test to bug mapping

Generated from `test_mapping.json` (regenerate with `verify_bugs.py --snapshot`). Test IDs are `module.Class.method`.
Every test not listed here passes on the participant version.

## OB-001 - Vault Index Integrity

public:
- `test_indexing.IndexBuilder.test_all_documents_present_for_various_sizes`
- `test_indexing.VaultIndex.test_every_document_is_searchable_by_its_marker`
- `test_indexing.VaultIndex.test_index_reports_every_document`

private:
- `test_private_index.PrivateIndex.test_every_size_around_segment_boundaries`
- `test_private_index.PrivateIndex.test_first_and_last_of_every_segment_are_present`
- `test_private_index.PrivateIndex.test_unsorted_input_is_still_complete_and_ordered`
- `test_private_index.PrivateIndexIntegration.test_large_ingest_is_fully_indexed`
- `test_private_index.PrivateIndexIntegration.test_not_universe_covers_every_document`

## OB-002 - Transaction Lookup

public:
- `test_transactions.TableUnit.test_all_sizes`
- `test_transactions.TransactionLookup.test_every_transaction_is_retrievable`
- `test_transactions.TransactionLookup.test_first_and_last_transactions`

private:
- `test_private_transactions.PrivateTransactionCli.test_custom_csv`
- `test_private_transactions.PrivateTransactions.test_exhaustive_small_tables`
- `test_private_transactions.PrivateTransactions.test_first_last_single_pair`
- `test_private_transactions.PrivateTransactions.test_large_random_tables`
- `test_private_transactions.PrivateTransactions.test_unsorted_input_is_sorted_on_load`

## OB-003 - Query History

public:
- `test_history.HistoryCli.test_undo_after_new_search`
- `test_history.HistoryUnit.test_new_query_discards_undone_states`

private:
- `test_private_history.PrivateHistory.test_deep_undo_then_diverge_twice`
- `test_private_history.PrivateHistory.test_persistence_between_operations`
- `test_private_history.PrivateHistory.test_random_operation_sequences_match_model`
- `test_private_history.PrivateHistoryCli.test_cli_sequence`

## OB-004 - Query Parser

public:
- `test_parser.ParserSemantics.test_not_group`
- `test_parser.ParserSemantics.test_not_leading`
- `test_parser.ParserTree.test_nested_groups`
- `test_parser.ParserTree.test_not_binds_tighter_than_and`

private:
- `test_private_parser.PrivateParser.test_hand_picked_precedence_cases`
- `test_private_parser.PrivateParser.test_random_expressions_match_oracle`

## OB-005 - Query Cache

public:
- `test_cache.CacheCli.test_recently_used_entry_survives_eviction`
- `test_cache.CacheUnit.test_keys_are_ordered_most_recent_first`
- `test_cache.CacheUnit.test_reading_refreshes_recency`
- `test_cache.CacheUnit.test_repeated_access_pattern`

private:
- `test_private_cache.PrivateCache.test_persistence_preserves_recency_order`
- `test_private_cache.PrivateCache.test_random_workloads_match_ordered_dict_model`
- `test_private_cache.PrivateCacheCli.test_scripted_scenario`

## OB-006 - Autocomplete at Scale

public:
- `test_autocomplete.AutocompleteScale.test_large_vocabulary_stays_fast`

private:
- `test_private_performance.PrivatePerformance.test_official_workload_threshold`
