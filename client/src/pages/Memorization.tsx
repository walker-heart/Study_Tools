import { Link } from "wouter";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

export default function Memorization() {
  return (
    <div className="container mx-auto px-4 py-8 max-w-4xl">
      <h1 className="text-3xl font-bold text-center mb-8">
        Study Tools
      </h1>
      <h2 className="text-xl font-semibold text-center mb-4">
        Select Mode
      </h2>

      <Card className="p-6">
        <div className="space-y-4">
          <div className="text-center">
            <p className="text-sm text-gray-600 mb-4">
              Choose your memorization mode:
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Link href="/memorization-easy">
              <Button className="w-full h-32 text-lg">
                Easy Mode
                <p className="text-sm mt-2 font-normal">
                  Slower pace, more forgiving
                </p>
              </Button>
            </Link>
            
            <Link href="/memorization-medium">
              <Button className="w-full h-32 text-lg">
                Medium Mode
                <p className="text-sm mt-2 font-normal">
                  Balanced pace and difficulty
                </p>
              </Button>
            </Link>
          </div>
        </div>
      </Card>
    </div>
  );
}