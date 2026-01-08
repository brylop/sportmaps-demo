import { Card, CardContent } from "@/components/ui/card";
import { LucideIcon } from "lucide-react";

interface FeatureCardProps {
  icon: LucideIcon;
  title: string;
  description: string;
  details: string[];
  variant?: "discovery" | "performance" | "community";
}

const FeatureCard = ({ icon: Icon, title, description, details, variant = "discovery" }: FeatureCardProps) => {
  const variantStyles = {
    discovery: "border-primary/20 hover:border-primary/40 hover:shadow-elevation",
    performance: "border-secondary/20 hover:border-secondary/40 hover:shadow-performance",
    community: "border-accent-foreground/20 hover:border-accent-foreground/40 hover:shadow-card"
  };

  const iconStyles = {
    discovery: "text-primary bg-primary/10",
    performance: "text-secondary bg-secondary/10", 
    community: "text-accent-foreground bg-accent-foreground/10"
  };

  return (
    <Card className={`transition-all duration-300 hover:scale-105 ${variantStyles[variant]}`}>
      <CardContent className="p-6">
        <div className={`w-12 h-12 rounded-lg flex items-center justify-center mb-4 ${iconStyles[variant]}`}>
          <Icon className="w-6 h-6" />
        </div>
        
        <h3 className="text-xl font-bold text-foreground mb-2">{title}</h3>
        <p className="text-muted-foreground mb-4 leading-relaxed">{description}</p>
        
        <ul className="space-y-2">
          {details.map((detail, index) => (
            <li key={index} className="flex items-start text-sm text-muted-foreground">
              <span className={`w-1.5 h-1.5 rounded-full mt-2 mr-3 flex-shrink-0 ${
                variant === "discovery" ? "bg-primary" :
                variant === "performance" ? "bg-secondary" : "bg-accent-foreground"
              }`} />
              {detail}
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  );
};

export default FeatureCard;