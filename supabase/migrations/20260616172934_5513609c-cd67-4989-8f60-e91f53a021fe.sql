alter table public.profiles add column if not exists gender text check (gender in ('male', 'female'));

update public.profiles set gender = 'male' where gender is null;
