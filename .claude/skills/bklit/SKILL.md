SKILL: Bklit UI - Gráficos y Visualización de Datos📝 DescripciónBklit UI es una biblioteca de componentes de visualización de datos de código abierto para React, construida como una extensión para shadcn/ui. Permite renderizar gráficos a través de una API componible. Soporta Tailwind CSS para el estilado y maneja transiciones y animaciones fluidas de forma nativa.📊 Gráficos DisponiblesLa biblioteca ofrece el siguiente catálogo de gráficos listos para usar e instalar:Area ChartBar ChartCandlestick ChartChoropleth ChartComposed ChartFunnel ChartGaugeHeatmap ChartLine ChartLive Line ChartPie ChartProfit/Loss LineRadar ChartRing ChartSankey ChartScatter ChartSunburst Chart📦 Instalación de ComponentesBklit distribuye sus componentes a través del registro de shadcn. No se instala como un paquete npm global, sino que agregas cada gráfico a tu proyecto individualmente según lo necesites.Para instalar un componente específico, utiliza la CLI de shadcn indicando el namespace @bklit seguido del nombre del gráfico (normalmente en formato kebab-case):# Ejemplo: Instalación de un gráfico de área y uno de línea
npx shadcn@latest add @bklit/area-chart
npx shadcn@latest add @bklit/line-chart

# Si utilizas pnpm:
pnpm dlx shadcn@latest add @bklit/ring-chart
Nota: Al ejecutar este comando, el código fuente del componente se descargará y se colocará en tu carpeta de componentes locales (generalmente en components/ui/bklit/...). Las dependencias internas necesarias también se instalarán automáticamente.💻 Patrones de Uso y ComposiciónBklit UI rechaza las configuraciones monolíticas y en su lugar favorece la composición de componentes de React. Combinas elementos primitivos para construir la visualización exacta que necesitas.Ejemplo: Gráfico de Área (Area Chart)Este ejemplo demuestra cómo envolver y componer los elementos de un gráfico.import { AreaChart, Area, Grid, XAxis, ChartTooltip } from "@/components/ui/bklit/area-chart";

export function SalesChart() {
  const chartData = [
    { month: "Jan", sales: 120 },
    { month: "Feb", sales: 250 },
    { month: "Mar", sales: 190 },
  ];

  return (
    // Es crucial que el contenedor padre tenga dimensiones explícitas o responsivas
    <div className="w-full h-[400px]">
      <AreaChart data={chartData}>
        {/* Componentes componibles para construir la UI del gráfico */}
        <Grid />
        <XAxis dataKey="month" />
        <ChartTooltip />
        <Area 
          dataKey="sales" 
          fill="currentColor" 
          className="text-blue-500" 
        />
      </AreaChart>
    </div>
  );
}

🤖 Directrices para Agentes de IA / LLMsAl generar código para proyectos que utilizan Bklit UI, aplica estrictamente las siguientes reglas:Arquitectura Shadcn (Código Local): Asume que los componentes fuente se inyectan en el proyecto local (usualmente en @/components/ui/...). No inventes props genéricas; respeta la composición de subcomponentes mostrada en los ejemplos.Estilado con Tailwind: Aplica estilos, colores, bordes y espaciados inyectando clases de Tailwind directamente en el className de los subcomponentes del gráfico. Evita estilos inline u objetos de configuración complejos para el diseño.Responsividad Automática: No fuerces anchos o altos en los componentes internos del gráfico. Estos leen automáticamente las dimensiones de su contenedor (div envolvente). Aplica clases como w-full min-h-[300px] únicamente al contenedor padre.Interactividad: Cuando generes gráficos complejos (ej. con zoom o "brush"), utiliza las utilidades propias de la librería (como ChartBrushLayout y ChartBrush), pasando propiedades dinámicas (como xDomain y yDomain) según la arquitectura de Bklit.Animaciones Delegadas: No añadas keyframes manuales ni bibliotecas externas para animar la entrada o salida de datos en el gráfico; Bklit UI maneja estas transiciones de manera nativa.