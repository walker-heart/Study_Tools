import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useSettings } from "@/contexts/SettingsContext";
import { useState } from "react";
import { AspectRatio } from "@/components/ui/aspect-ratio";
import { Image } from "lucide-react";

export default function ImageToText() {
  const { theme } = useSettings();
  const [selectedImage, setSelectedImage] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      setSelectedImage(file);
      const reader = new FileReader();
      reader.onloadend = () => {
        setImagePreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  return (
    <div className={`container mx-auto px-4 py-8 ${theme === 'dark' ? 'dark' : ''}`}>
      <h1 className="text-3xl font-bold mb-8">Image to Text</h1>
      <Card className="p-6">
        <div className="space-y-4">
          <div className="border-2 border-dashed rounded-lg p-4">
            <Input
              type="file"
              accept="image/*"
              onChange={handleImageChange}
              className="w-full"
            />
            {imagePreview && (
              <AspectRatio ratio={16 / 9} className="mt-2">
                <img
                  src={imagePreview}
                  alt="Preview"
                  className="rounded-lg object-cover w-full h-full"
                />
              </AspectRatio>
            )}
          </div>
          <Button
            disabled={!selectedImage}
            className="w-full"
          >
            <Image className="w-4 h-4 mr-2" />
            Extract Text
          </Button>
        </div>
      </Card>
    </div>
  );
}
