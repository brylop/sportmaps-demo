import React, { useState } from 'react';
import { EventWizardState, WizardAction } from './WizardTypes';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { PlusCircle, Trash2 } from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

interface Props {
  state: EventWizardState;
  dispatch: React.Dispatch<WizardAction>;
}

const TEMPLATE_LEVELS = ['1', '2', '3', '4', '4.2', '5', '6', '7', 'N/A'];
const TEMPLATE_RAMAS = ['Femenino', 'Mixto', 'Masculino'];

export function Step2Categories({ state, dispatch }: Props) {
  const { categories, eventInfo } = state;
  const [newCat, setNewCat] = useState({
    division: 'All Star',
    level: '1',
    category: 'Mini',
    rama: 'Femenino',
    min_age: 5,
    max_age: 8,
    min_athletes: 5,
    max_athletes: 38,
    base_price: 0
  });

  const handleAddCategory = () => {
    dispatch({ type: 'UPDATE_CATEGORIES', payload: [...categories, { ...newCat }] });
  };

  const handleRemoveCategory = (index: number) => {
    const newArr = [...categories];
    newArr.splice(index, 1);
    dispatch({ type: 'UPDATE_CATEGORIES', payload: newArr });
  };

  const seedAllStarCategories = () => {
    // Quick template specifically requested
    const templates = [
      { division: 'All Star', level: '1', category: 'Mini', rama: 'Femenino', min_age: 5, max_age: 8, min_athletes: 5, max_athletes: 38, base_price: 0 },
      { division: 'All Star', level: '1', category: 'Youth', rama: 'Femenino', min_age: 8, max_age: 11, min_athletes: 5, max_athletes: 38, base_price: 0 },
      { division: 'All Star', level: '2', category: 'Junior', rama: 'Mixto', min_age: 9, max_age: 14, min_athletes: 5, max_athletes: 38, base_price: 0 },
    ];
    dispatch({ type: 'UPDATE_CATEGORIES', payload: [...categories, ...templates] });
  };

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-right-4">
      <div className="flex justify-between items-center">
        <div>
          <h3 className="text-lg font-medium">Categorías Competitivas</h3>
          <p className="text-sm text-muted-foreground">Configura las divisiones en las que se inscribirán los equipos.</p>
        </div>
        {eventInfo.sport === 'Porrismo' && (
          <Button variant="outline" onClick={seedAllStarCategories}>Cargar Plantilla All-Star</Button>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 lg:grid-cols-5 gap-3 p-4 bg-slate-50 border rounded-xl items-end">
        <div className="space-y-1"><Label>División</Label><Input value={newCat.division} onChange={e => setNewCat({...newCat, division: e.target.value})} placeholder="Ej. All Star"/></div>
        <div className="space-y-1">
          <Label>Nivel</Label>
          <Select value={newCat.level} onValueChange={(v) => setNewCat({...newCat, level: v})}>
             <SelectTrigger><SelectValue/></SelectTrigger>
             <SelectContent>{TEMPLATE_LEVELS.map(l => <SelectItem key={l} value={l}>{l}</SelectItem>)}</SelectContent>
          </Select>
        </div>
        <div className="space-y-1"><Label>Categoría</Label><Input value={newCat.category} onChange={e => setNewCat({...newCat, category: e.target.value})} placeholder="Ej. Mini"/></div>
        <div className="space-y-1">
          <Label>Rama</Label>
          <Select value={newCat.rama} onValueChange={(v) => setNewCat({...newCat, rama: v})}>
             <SelectTrigger><SelectValue/></SelectTrigger>
             <SelectContent>{TEMPLATE_RAMAS.map(l => <SelectItem key={l} value={l}>{l}</SelectItem>)}</SelectContent>
          </Select>
        </div>
        
        <div className="space-y-1"><Label>Edad Mín</Label><Input type="number" value={newCat.min_age} onChange={e => setNewCat({...newCat, min_age: Number(e.target.value)})}/></div>
        <div className="space-y-1"><Label>Edad Máx</Label><Input type="number" value={newCat.max_age} onChange={e => setNewCat({...newCat, max_age: Number(e.target.value)})}/></div>
        <div className="space-y-1"><Label>Min Atletas</Label><Input type="number" value={newCat.min_athletes} onChange={e => setNewCat({...newCat, min_athletes: Number(e.target.value)})}/></div>
        <div className="space-y-1"><Label>Max Atletas</Label><Input type="number" value={newCat.max_athletes} onChange={e => setNewCat({...newCat, max_athletes: Number(e.target.value)})}/></div>
        <div className="space-y-1"><Label>Extra ($)</Label><Input type="number" value={newCat.base_price} onChange={e => setNewCat({...newCat, base_price: Number(e.target.value)})}/></div>
        
        <div className="md:col-span-4 lg:col-span-1 pt-2">
          <Button onClick={handleAddCategory} className="w-full gap-2"><PlusCircle className="h-4 w-4"/> Añadir</Button>
        </div>
      </div>

      {categories.length > 0 ? (
        <div className="border rounded-md overflow-x-auto">
          <Table>
            <TableHeader className="bg-slate-50">
              <TableRow>
                <TableHead>División</TableHead>
                <TableHead>Nivel</TableHead>
                <TableHead>Categoría</TableHead>
                <TableHead>Rama</TableHead>
                <TableHead>Edades</TableHead>
                <TableHead>Atletas</TableHead>
                <TableHead></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {categories.map((c, i) => (
                <TableRow key={i}>
                  <TableCell>{c.division}</TableCell>
                  <TableCell>{c.level}</TableCell>
                  <TableCell>{c.category}</TableCell>
                  <TableCell>{c.rama}</TableCell>
                  <TableCell>{c.min_age} - {c.max_age}</TableCell>
                  <TableCell>{c.min_athletes} - {c.max_athletes}</TableCell>
                  <TableCell>
                    <Button variant="ghost" size="icon" onClick={() => handleRemoveCategory(i)} className="text-red-500 hover:text-red-600 hover:bg-red-50">
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      ) : (
        <div className="p-8 text-center border border-dashed rounded-lg text-muted-foreground">
          No hay categorías definidas. Añade al menos una.
        </div>
      )}

      <div className="flex justify-between pt-4">
        <Button variant="outline" onClick={() => dispatch({ type: 'PREV_STEP' })}>Atrás</Button>
        <Button onClick={() => dispatch({ type: 'NEXT_STEP' })} disabled={categories.length === 0}>
          Continuar: Fases de Precio
        </Button>
      </div>
    </div>
  );
}
