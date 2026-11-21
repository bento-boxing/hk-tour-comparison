-- Big Line Holiday 大航假期: its home address as the rest of the project has it. 0001 stored https://www.bigline.hk,
-- a host the scraper never requests (it reads https://bigline.hk, and refuses www.bigline.hk as a tour address;
-- docs/operators/bigline.md, README). The address became visible with the operator pages (task 51), as the link
-- to the operator's official site.
update operators set site_url = 'https://bigline.hk/' where id = 'bigline';
