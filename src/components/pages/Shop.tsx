import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { 
  Search,
  ShoppingCart,
  Star,
  Heart,
  ArrowLeft,
  Filter,
  TrendingUp,
  Store
} from "lucide-react";
import Logo from "@/components/Logo";

interface ShopProps {
  onNavigate: (page: string) => void;
}

const Shop = ({ onNavigate }: ShopProps) => {
  const [searchTerm, setSearchTerm] = useState("");
  const [category, setCategory] = useState("all");

  const stores = [
    {
      id: 1,
      name: "SportGear Colombia",
      description: "Equipamiento deportivo profesional",
      logo: "https://images.unsplash.com/photo-1556906781-9a412961c28c?w=100&auto=format&fit=crop",
      rating: 4.8,
      products: 342,
      verified: true
    },
    {
      id: 2,
      name: "FitTech Store",
      description: "Tecnología y wearables deportivos",
      logo: "https://images.unsplash.com/photo-1523206489230-c012c64b2b48?w=100&auto=format&fit=crop",
      rating: 4.7,
      products: 156,
      verified: true
    },
    {
      id: 3,
      name: "Nutrición Deportiva Pro",
      description: "Suplementos y nutrición",
      logo: "https://images.unsplash.com/photo-1593095948071-474c5cc2989d?w=100&auto=format&fit=crop",
      rating: 4.9,
      products: 89,
      verified: true
    }
  ];

  const products = [
    {
      id: 1,
      name: "Balón Nike Pro",
      store: "SportGear Colombia",
      price: 85000,
      image: "https://images.unsplash.com/photo-1551537482-f2075a1d41f2?w=400&auto=format&fit=crop",
      rating: 4.8,
      reviews: 145,
      category: "Balones",
      discount: 15
    },
    {
      id: 2,
      name: "Tenis Adidas Ultra Boost",
      store: "SportGear Colombia",
      price: 320000,
      image: "https://images.unsplash.com/photo-1542291026-7eec264c27ff?w=400&auto=format&fit=crop",
      rating: 4.9,
      reviews: 298,
      category: "Calzado",
      discount: 0
    },
    {
      id: 3,
      name: "Smartwatch Garmin Forerunner",
      store: "FitTech Store",
      price: 850000,
      image: "https://images.unsplash.com/photo-1523206489230-c012c64b2b48?w=400&auto=format&fit=crop",
      rating: 4.7,
      reviews: 234,
      category: "Tecnología",
      discount: 10
    },
    {
      id: 4,
      name: "Proteína Whey Gold Standard",
      store: "Nutrición Deportiva Pro",
      price: 180000,
      image: "https://images.unsplash.com/photo-1593095948071-474c5cc2989d?w=400&auto=format&fit=crop",
      rating: 4.9,
      reviews: 456,
      category: "Suplementos",
      discount: 20
    },
    {
      id: 5,
      name: "Guayos Nike Mercurial",
      store: "SportGear Colombia",
      price: 450000,
      image: "https://images.unsplash.com/photo-1579952363873-27f3bade9f55?w=400&auto=format&fit=crop",
      rating: 4.8,
      reviews: 189,
      category: "Calzado",
      discount: 0
    },
    {
      id: 6,
      name: "Set de Mancuernas Ajustables",
      store: "SportGear Colombia",
      price: 280000,
      image: "https://images.unsplash.com/photo-1517836357463-d25dfeac3438?w=400&auto=format&fit=crop",
      rating: 4.6,
      reviews: 167,
      category: "Gimnasio",
      discount: 25
    }
  ];

  return (
    <div className="min-h-screen bg-gradient-to-b from-background to-muted/20">
      {/* Header */}
      <header className="sticky top-0 z-50 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="container mx-auto px-4">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center gap-4">
              <Button 
                variant="ghost" 
                size="icon"
                onClick={() => onNavigate("dashboard")}
              >
                <ArrowLeft className="h-5 w-5" />
              </Button>
              <button 
                className="flex items-center gap-3 hover:opacity-80 transition-opacity"
                onClick={() => onNavigate("landing")}
              >
                <Logo size="md" />
                <h1 className="text-xl font-bold">SportMaps</h1>
              </button>
            </div>
            <nav className="hidden md:flex items-center gap-6">
              <button 
                className="font-medium hover:text-primary transition-colors"
                onClick={() => onNavigate("dashboard")}
              >
                Inicio
              </button>
              <button 
                className="font-medium hover:text-primary transition-colors"
                onClick={() => onNavigate("schoolsearch")}
              >
                Explorar
              </button>
              <button className="font-medium text-primary">
                Tienda
              </button>
              <button 
                className="font-medium hover:text-primary transition-colors"
                onClick={() => onNavigate("wellness")}
              >
                Bienestar
              </button>
            </nav>
            <Button size="sm">
              <ShoppingCart className="h-4 w-4 mr-2" />
              Carrito (0)
            </Button>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8 max-w-7xl">
        {/* Page Title */}
        <div className="mb-8">
          <h1 className="text-4xl font-bold mb-3 flex items-center gap-3">
            <Store className="h-10 w-10 text-primary" />
            Tienda SportMaps
          </h1>
          <p className="text-lg text-muted-foreground">
            Encuentra todo el equipamiento deportivo que necesitas
          </p>
        </div>

        {/* Featured Stores */}
        <div className="mb-12">
          <h2 className="text-2xl font-bold mb-6">Tiendas Destacadas</h2>
          <div className="grid md:grid-cols-3 gap-6">
            {stores.map((store) => (
              <Card key={store.id} className="hover:shadow-lg transition-shadow">
                <CardContent className="p-6">
                  <div className="flex items-start gap-4 mb-4">
                    <div 
                      className="w-16 h-16 rounded-lg bg-cover bg-center flex-shrink-0"
                      style={{ backgroundImage: `url(${store.logo})` }}
                    />
                    <div className="flex-1">
                      <div className="flex items-start justify-between">
                        <h3 className="font-bold text-lg">{store.name}</h3>
                        {store.verified && (
                          <Badge variant="secondary" className="bg-green-500/20 text-green-700">
                            Verificada
                          </Badge>
                        )}
                      </div>
                      <p className="text-sm text-muted-foreground mt-1">{store.description}</p>
                    </div>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <div className="flex items-center gap-1">
                      <Star className="h-4 w-4 text-yellow-500 fill-current" />
                      <span className="font-semibold">{store.rating}</span>
                    </div>
                    <span className="text-muted-foreground">{store.products} productos</span>
                  </div>
                  <Button className="w-full mt-4" variant="outline">
                    Visitar Tienda
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>

        {/* Search and Filters */}
        <Card className="mb-8">
          <CardContent className="p-6">
            <div className="grid md:grid-cols-3 gap-4">
              <div className="relative md:col-span-2">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
                <Input
                  placeholder="Buscar productos..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>
              <Select value={category} onValueChange={setCategory}>
                <SelectTrigger>
                  <SelectValue placeholder="Categoría" />
                </SelectTrigger>
                <SelectContent className="z-50 bg-background">
                  <SelectItem value="all">Todas las categorías</SelectItem>
                  <SelectItem value="calzado">Calzado</SelectItem>
                  <SelectItem value="ropa">Ropa</SelectItem>
                  <SelectItem value="tecnologia">Tecnología</SelectItem>
                  <SelectItem value="suplementos">Suplementos</SelectItem>
                  <SelectItem value="gimnasio">Gimnasio</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        {/* Products Grid */}
        <div className="mb-6 flex items-center justify-between">
          <h2 className="text-2xl font-bold">Productos Destacados</h2>
          <Button variant="outline" size="sm">
            <Filter className="h-4 w-4 mr-2" />
            Filtros
          </Button>
        </div>

        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6 mb-12">
          {products.map((product) => (
            <Card key={product.id} className="overflow-hidden hover:shadow-lg transition-all duration-300 hover:-translate-y-1 group">
              <div className="relative">
                <div 
                  className="h-56 bg-cover bg-center"
                  style={{ backgroundImage: `url(${product.image})` }}
                />
                {product.discount > 0 && (
                  <Badge className="absolute top-3 left-3 bg-red-500 text-white">
                    -{product.discount}%
                  </Badge>
                )}
                <Button 
                  variant="secondary" 
                  size="icon"
                  className="absolute top-3 right-3 opacity-0 group-hover:opacity-100 transition-opacity"
                >
                  <Heart className="h-4 w-4" />
                </Button>
              </div>
              <CardContent className="p-4">
                <Badge variant="secondary" className="mb-2 text-xs">
                  {product.category}
                </Badge>
                <h3 className="font-bold text-lg mb-1">{product.name}</h3>
                <p className="text-sm text-muted-foreground mb-2">{product.store}</p>
                <div className="flex items-center gap-1 mb-3">
                  <Star className="h-4 w-4 text-yellow-500 fill-current" />
                  <span className="text-sm font-semibold">{product.rating}</span>
                  <span className="text-xs text-muted-foreground">({product.reviews})</span>
                </div>
                <div className="flex items-center justify-between">
                  <div>
                    {product.discount > 0 && (
                      <p className="text-sm text-muted-foreground line-through">
                        ${product.price.toLocaleString()}
                      </p>
                    )}
                    <p className="text-xl font-bold text-primary">
                      ${((product.price * (100 - product.discount)) / 100).toLocaleString()}
                    </p>
                  </div>
                  <Button size="sm">
                    <ShoppingCart className="h-4 w-4 mr-2" />
                    Agregar
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* CTA */}
        <Card className="bg-gradient-to-r from-primary/10 to-primary/5 border-primary/20">
          <CardContent className="py-8 text-center">
            <TrendingUp className="h-16 w-16 text-primary mx-auto mb-4" />
            <h3 className="text-2xl font-bold mb-2">¿Vendes productos deportivos?</h3>
            <p className="text-muted-foreground mb-6">
              Únete a SportMaps y vende a miles de deportistas
            </p>
            <Button size="lg" onClick={() => onNavigate("register")}>
              Abrir mi Tienda
            </Button>
          </CardContent>
        </Card>
      </main>
    </div>
  );
};

export default Shop;
