import logoImage from "@/assets/sportmaps-logo.png";

interface LogoProps {
  size?: "sm" | "md" | "lg" | "xl";
  className?: string;
}

const Logo = ({ size = "md", className = "" }: LogoProps) => {
  const sizeClasses = {
    sm: "h-6 w-6",
    md: "h-8 w-8", 
    lg: "h-12 w-12",
    xl: "h-16 w-16"
  };

  return (
    <img 
      src={logoImage} 
      alt="SportMaps Logo" 
      className={`${sizeClasses[size]} object-contain ${className}`}
    />
  );
};

export default Logo;