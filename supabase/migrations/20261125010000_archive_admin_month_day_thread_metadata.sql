begin;

do $migration$
declare
  original text;
  anchor text := '''thumbnailUrl'', coalesce(thumbnail_url, ''''), ''status'', status';
  metadata text := $fields$,
      'twitterConversationId', coalesce(nullif(thread_root_tweet_id, ''), nullif(twitter_conversation_id, ''), ''),
      'twitterStatusId', coalesce(tweet_id, substring(source_url from '/status(?:es)?/([0-9]+)'), '')$fields$;
begin
  original := pg_get_functiondef('public.hq_admin_archive_month_day(text,text,text,bigint,bigint,integer,integer)'::regprocedure);
  if strpos(original, '''twitterConversationId''') > 0 then
    return;
  end if;
  if array_length(string_to_array(original, anchor), 1) <> 2 then
    raise exception 'Unexpected archive admin month-day function definition';
  end if;
  execute replace(original, anchor, anchor || metadata);
end $migration$;

commit;
