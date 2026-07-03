insert into public.point_wallets (user_id, balance, updated_at)
select id, greatest(coalesce(points, 0), 0), now()
from public.profiles
on conflict (user_id) do update
set balance = greatest(public.point_wallets.balance, excluded.balance),
    updated_at = now();
