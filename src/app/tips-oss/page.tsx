
import { Header } from "@/components/site/header";
import { Footer } from "@/components/site/footer";
import { TipsForm } from "@/components/site/tips-form";

export default function TipsOssPage() {
    return (
        <div className="flex flex-col min-h-screen">
            <Header />
            <main className="flex-1 py-16 md:py-24 bg-muted">
                <div className="container flex-grow flex items-center justify-center">
                    <TipsForm />
                </div>
            </main>
            <Footer />
        </div>
    );
}
