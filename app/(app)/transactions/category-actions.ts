"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { fetchAllPages } from "@/lib/supabase/fetch-all-pages";
import { isUserCategoryType, normalizeCategoryName } from "@/lib/category-name";

type CategoryDirection = "income" | "expense";
export type CreateUserCategoryResult =
  | { ok: true; category: { id: string; name: string; category_type: CategoryDirection } }
  | { ok: false; message: string };

const DUPLICATE_MESSAGE = "Kategori dengan nama itu sudah tersedia untuk jenis transaksi ini.";

export async function createUserCategory(input: {
  name: string;
  category_type: string;
}): Promise<CreateUserCategoryResult> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ok: false, message: "Sesi berakhir. Silakan masuk kembali." };

  if (!input || typeof input.name !== "string" || typeof input.category_type !== "string") {
    return { ok: false, message: "Data kategori tidak valid." };
  }
  const name = input.name.trim().replace(/\s+/g, " ");
  if (!name || name.length > 60) {
    return { ok: false, message: "Nama kategori wajib diisi (maksimal 60 karakter)." };
  }
  if (!isUserCategoryType(input.category_type)) {
    return { ok: false, message: "Pilih jenis kategori Pemasukan atau Pengeluaran." };
  }

  // Include public system categories; users cannot create duplicates of
  // either their own active categories or available defaults.
  try {
    const existing = await fetchAllPages((from, to) =>
      supabase
        .from("categories")
        .select("id, name")
        .eq("category_type", input.category_type)
        .eq("is_archived", false)
        .or(`user_id.eq.${user.id},user_id.is.null`)
        .order("id")
        .range(from, to),
    );
    if (existing.some((row) => normalizeCategoryName(row.name) === normalizeCategoryName(name))) {
      return { ok: false, message: DUPLICATE_MESSAGE };
    }
  } catch {
    return { ok: false, message: "Tidak dapat memeriksa kategori. Coba lagi." };
  }

  const { data, error } = await supabase
    .from("categories")
    .insert({
      user_id: user.id,
      name,
      category_type: input.category_type,
      is_system: false,
      is_archived: false,
    })
    .select("id, name, category_type")
    .single();

  if (error || !data) {
    return {
      ok: false,
      message: error?.code === "23505" ? DUPLICATE_MESSAGE : "Kategori gagal disimpan. Coba lagi.",
    };
  }

  revalidatePath("/transactions");
  return {
    ok: true,
    category: { id: data.id, name: data.name, category_type: input.category_type },
  };
}
