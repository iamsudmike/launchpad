import AuthGate from "@/components/AuthGate";
import Board from "@/components/Board";

export default function Home() {
  return (
    <AuthGate>
      <Board />
    </AuthGate>
  );
}
