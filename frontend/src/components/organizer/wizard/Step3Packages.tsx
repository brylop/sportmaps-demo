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

export function Step3Packages({ state, dispatch }: Props) {
  const { pricePhases, eventInfo } = state;
  const [newPhase, setNewPhase] = useState({
    phase_name: 'Preventa',
    valid_until: '',
    pkg_1_price: 350000,
    pkg_2_price: 250000,
    pkg_3_price: 150000,
    pkg_solo_price: 80000,
    kit_type: 'Full',
    crossover_price: 50000,
    deposit_percentage: 10
  });

  const handleAddPhase = () => {
    dispatch({ type: 'UPDATE_PRICE_PHASES', payload: [...pricePhases, { ...newPhase }] });
    setNewPhase({
      ...newPhase,
      phase_name: 'Fase Regular',
      valid_until: '',
    });
  };

  const handleRemovePhase = (index: number) => {
    const newArr = [...pricePhases];
    newArr.splice(index, 1);
    dispatch({ type: 'UPDATE_PRICE_PHASES', payload: newArr });
  };

  const seedAbierto26 = () => {
    const templates = [
      { phase_name: 'Fase 1 (Preventa)', valid_until: '2026-06-30', pkg_1_price: 390000, pkg_2_price: 290000, pkg_3_price: 190000, pkg_solo_price: 100000, kit_type: 'Platino', crossover_price: 60000, deposit_percentage: 10 },
      { phase_name: 'Fase 2', valid_until: '2026-08-15', pkg_1_price: 450000, pkg_2_price: 350000, pkg_3_price: 250000, pkg_solo_price: 130000, kit_type: 'Gold', crossover_price: 80000, deposit_percentage: 10 },
      { phase_name: 'Fase 3 (Ordinaria)', valid_until: '2026-09-15', pkg_1_price: 550000, pkg_2_price: 450000, pkg_3_price: 350000, pkg_solo_price: 160000, kit_type: 'Silver', crossover_price: 100000, deposit_percentage: 20 },
    ];
    dispatch({ type: 'UPDATE_PRICE_PHASES', payload: [...pricePhases, ...templates] });
  };

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-right-4">
      <div className="flex justify-between items-center">
        <div>
          <h3 className="text-lg font-medium">Fases de Precio y Paquetes</h3>
          <p className="text-sm text-muted-foreground">Define los paquetes según el alojamiento y fecha de inscripción.</p>
        </div>
        {eventInfo.sport === 'Porrismo' && (
          <Button variant="outline" onClick={seedAbierto26}>Cargar Precios Abierto 26</Button>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-4 p-4 bg-slate-50 border rounded-xl items-end">
        <div className="space-y-1"><Label>Nombre Fase</Label><Input value={newPhase.phase_name} onChange={e => setNewPhase({...newPhase, phase_name: e.target.value})} placeholder="Ej. Fase 1"/></div>
        <div className="space-y-1"><Label>Válida Hasta</Label><Input type="date" value={newPhase.valid_until} onChange={e => setNewPhase({...newPhase, valid_until: e.target.value})}/></div>
        <div className="space-y-1">
          <Label>Tipo de Kit</Label>
          <Select value={newPhase.kit_type} onValueChange={(v) => setNewPhase({...newPhase, kit_type: v})}>
             <SelectTrigger><SelectValue/></SelectTrigger>
             <SelectContent>
                <SelectItem value="Full">Full</SelectItem>
                <SelectItem value="Platino">Platino</SelectItem>
                <SelectItem value="Gold">Gold</SelectItem>
                <SelectItem value="Silver">Silver</SelectItem>
                <SelectItem value="Basic">Basico</SelectItem>
             </SelectContent>
          </Select>
        </div>
        <div className="space-y-1"><Label>% Reserva</Label><Input type="number" value={newPhase.deposit_percentage} onChange={e => setNewPhase({...newPhase, deposit_percentage: Number(e.target.value)})}/></div>

        <div className="space-y-1"><Label>Pkg 1 (4 Noches)</Label><Input type="number" value={newPhase.pkg_1_price} onChange={e => setNewPhase({...newPhase, pkg_1_price: Number(e.target.value)})}/></div>
        <div className="space-y-1"><Label>Pkg 2 (3 Noches)</Label><Input type="number" value={newPhase.pkg_2_price} onChange={e => setNewPhase({...newPhase, pkg_2_price: Number(e.target.value)})}/></div>
        <div className="space-y-1"><Label>Pkg 3 (2 Noches)</Label><Input type="number" value={newPhase.pkg_3_price} onChange={e => setNewPhase({...newPhase, pkg_3_price: Number(e.target.value)})}/></div>
        <div className="space-y-1"><Label>Solo Competencia</Label><Input type="number" value={newPhase.pkg_solo_price} onChange={e => setNewPhase({...newPhase, pkg_solo_price: Number(e.target.value)})}/></div>
        
        <div className="space-y-1"><Label>Crossover</Label><Input type="number" value={newPhase.crossover_price} onChange={e => setNewPhase({...newPhase, crossover_price: Number(e.target.value)})}/></div>
        
        <div className="md:col-span-2 lg:col-span-3 pt-2 flex justify-end">
          <Button onClick={handleAddPhase} className="gap-2"><PlusCircle className="h-4 w-4"/> Añadir Fase</Button>
        </div>
      </div>

      {pricePhases.length > 0 ? (
        <div className="border rounded-md overflow-x-auto">
          <Table>
            <TableHeader className="bg-slate-50">
              <TableRow>
                <TableHead>Fase</TableHead>
                <TableHead>Límite</TableHead>
                <TableHead>Pkg 1</TableHead>
                <TableHead>Pkg 2</TableHead>
                <TableHead>Pkg 3</TableHead>
                <TableHead>Solo Compe</TableHead>
                <TableHead>Crossover</TableHead>
                <TableHead>Kit</TableHead>
                <TableHead></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {pricePhases.map((p, i) => (
                <TableRow key={i}>
                  <TableCell className="font-medium">{p.phase_name}</TableCell>
                  <TableCell>{p.valid_until}</TableCell>
                  <TableCell>${p.pkg_1_price.toLocaleString()}</TableCell>
                  <TableCell>${p.pkg_2_price.toLocaleString()}</TableCell>
                  <TableCell>${p.pkg_3_price.toLocaleString()}</TableCell>
                  <TableCell>${p.pkg_solo_price.toLocaleString()}</TableCell>
                  <TableCell>${p.crossover_price.toLocaleString()}</TableCell>
                  <TableCell>{p.kit_type}</TableCell>
                  <TableCell>
                    <Button variant="ghost" size="icon" onClick={() => handleRemovePhase(i)} className="text-red-500 hover:text-red-600 hover:bg-red-50">
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
          No hay fases de precio definidas. Añade al menos una fase de registro.
        </div>
      )}

      <div className="flex justify-between pt-4">
        <Button variant="outline" onClick={() => dispatch({ type: 'PREV_STEP' })}>Atrás</Button>
        <Button onClick={() => dispatch({ type: 'NEXT_STEP' })} disabled={pricePhases.length === 0}>
          Continuar: Fechas y Reglas
        </Button>
      </div>
    </div>
  );
}
