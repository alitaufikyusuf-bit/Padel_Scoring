import { JoinView } from "@/views/join";

/* Tautan undangan /join/KODE. Halaman ini hanya meneruskan kodenya ke shell
   dan langsung membuka layar Gabung; pencarian ruangnya dikerjakan di klien
   karena kunci pencatat tidak boleh melewati server render. */
export default async function Page({ params }: { params: Promise<{ room: string }> }) {
  const { room } = await params;
  return <JoinView room={room} />;
}
