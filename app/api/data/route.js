import clientPromise from '@/lib/mongodb';
import { NextResponse } from 'next/server';

// ================= GET: AMBIL SEMUA DATA DARI MONGODB =================
export async function GET() {
  try {
    const client = await clientPromise;
    const db = client.db("fitpoint_db");
    
    // Ambil data user & aktivitas secara realtime dari cluster cloud
    const users = await db.collection("users").find({}).toArray();
    const activities = await db.collection("activities").find({}).sort({ _id: -1 }).toArray();
    
    return NextResponse.json({ activities, users });
  } catch (e) {
    return NextResponse.json({ success: false, error: "Gagal memuat data dari database: " + e.message }, { status: 500 });
  }
}

// ================= POST: MANIPULASI DATA BERDASARKAN AKSI =================
export async function POST(request) {
  try {
    const client = await clientPromise;
    const db = client.db("fitpoint_db");
    const body = await request.json();
    const { action } = body;

    // 1. Aksi Registrasi Akun Baru
    if (action === 'register') {
      const { user } = body;
      const existing = await db.collection("users").findOne({ email: user.email });
      if (existing) {
        return NextResponse.json({ success: false, error: "Email sudah terdaftar!" }, { status: 400 });
      }
      await db.collection("users").insertOne(user);
      return NextResponse.json({ success: true, message: "Registrasi berhasil disimpan ke MongoDB!" });
    }

    // 2. Aksi Perbarui Profil Pengguna
    if (action === 'update_profile') {
      const { user } = body;
      await db.collection("users").replaceOne({ id: user.id }, user, { upsert: true });
      return NextResponse.json({ success: true, message: "Profil berhasil diperbarui di MongoDB!" });
    }

    // 3. Aksi Simpan / Update Akumulasi Aktivitas Latihan
    if (action === 'save_activity') {
      const { activity } = body;
      // Menggunakan replaceOne dengan upsert: true agar data ter-update otomatis jika ID sama
      await db.collection("activities").replaceOne({ id: activity.id }, activity, { upsert: true });
      return NextResponse.json({ success: true, message: "Aktivitas berhasil disinkronkan ke MongoDB!" });
    }

    // 4. Aksi Hapus Log Aktivitas Latihan
    if (action === 'delete_activity') {
      const { id } = body;
      await db.collection("activities").deleteOne({ id: id });
      return NextResponse.json({ success: true, message: "Aktivitas berhasil dihapus dari MongoDB!" });
    }

    return NextResponse.json({ success: false, error: "Aksi tidak dikenal" }, { status: 400 });
  } catch (e) {
    return NextResponse.json({ success: false, error: "Terjadi kesalahan server: " + e.message }, { status: 500 });
  }
}