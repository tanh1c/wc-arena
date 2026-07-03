update public.player_cards
set image_url = regexp_replace(image_url, '^https://imgcdn\.dev/i/([^./]+)$', 'https://s6.imgcdn.dev/\1.png')
where image_url ~ '^https://imgcdn\.dev/i/[^./]+$';

update public.player_cards
set image_url = replace(image_url, '.png.png', '.png')
where image_url like '%.png.png';
