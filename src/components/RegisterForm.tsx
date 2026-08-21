import React from 'react';

export default function RegisterForm() {
  return (
    <div className="flex flex-col h-screen bg-gray-50">
      
      {/* HEADER FIJO */}
      <div className="p-4 bg-white shadow-sm">
        <h1 className="text-xl font-bold text-center">Registro</h1>
      </div>

      {/* CONTENIDO CON SCROLL - ESTO ES LO IMPORTANTE */}
      <div className="flex-1 overflow-y-auto px-4 py-6">
        
        {/* ROL DE REGISTRO */}
        <div className="mb-4">
          <p className="text-sm text-gray-500 mb-2">ROL DE REGISTRO</p>
          <div className="grid grid-cols-2 gap-3">
            <button type="button" className="border-2 border-green-500 rounded-xl p-3 flex flex-col items-center bg-green-50">
              <span>👤</span>
              <span className="font-semibold">PASAJERO</span>
            </button>
            <button type="button" className="border-2 border-gray-200 rounded-xl p-3 flex flex-col items-center">
              <span>🚗</span>
              <span className="font-semibold">CONDUCTOR</span>
            </button>
          </div>
        </div>

        {/* CAMPOS DEL FORMULARIO */}
        <div className="space-y-4">
          {/* CÉDULA */}
          <div>
            <label className="block text-sm font-semibold text-gray-600 mb-1">CÉDULA</label>
            <input type="number" className="w-full p-3 border rounded-lg" placeholder="11379008"/>
          </div>

          {/* TELÉFONO */}
          <div>
            <label className="block text-sm font-semibold text-gray-600 mb-1">TELÉFONO</label>
            <input type="tel" className="w-full p-3 border rounded-lg" placeholder="3012991845"/>
          </div>

          {/* DEPARTAMENTO */}
          <div>
            <label className="block text-sm font-semibold text-gray-600 mb-1">DEPARTAMENTO</label>
            <select className="w-full p-3 border rounded-lg">
              <option>Cundinamarca</option>
            </select>
          </div>

          {/* CIUDAD */}
          <div>
            <label className="block text-sm font-semibold text-gray-600 mb-1">CIUDAD / MUNICIPIO</label>
            <select className="w-full p-3 border rounded-lg">
              <option>Fusagasugá</option>
            </select>
          </div>

          {/* GÉNERO */}
          <div>
            <label className="block text-sm font-semibold text-gray-600 mb-1">GÉNERO</label>
            <select className="w-full p-3 border rounded-lg">
              <option>Masculino</option>
            </select>
          </div>

          {/* TEXTO AYUDA */}
          <p className="text-sm text-green-700">✍️ ¿No aparece tu departamento o ciudad? Escríbelos aquí</p>

          {/* CHECKBOX */}
          <div className="flex items-center gap-2">
            <input type="checkbox" className="w-5 h-5" defaultChecked />
            <span>Acepto el <a className="text-blue-500 cursor-pointer">tratamiento de datos</a></span>
          </div>

          {/* ESPACIO PARA QUE EL BOTON NO QUEDE PEGADO */}
          <div className="h-20"></div>
        </div>
      </div>

      {/* BOTÓN FIJO ABAJO */}
      <div className="p-4 bg-white shadow-[0_-2px_10px_rgba(0,0,0,0.1)]">
        <button type="button" className="w-full bg-green-500 text-white font-bold py-4 rounded-xl">
          CONTINUAR REGISTRO
        </button>
      </div>
    </div>
  );
}
