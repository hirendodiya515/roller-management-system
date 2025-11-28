export const DEFAULT_FIELDS = [
    { id: 'date', label: 'Date of Activity', type: 'date', required: true, visible: true, isSystem: true },
    { id: 'activity', label: 'Activity Type', type: 'text', required: true, visible: true, isSystem: true },
    { id: 'runningLine', label: 'Current Running Line', type: 'dropdown', required: true, visible: true, isSystem: true, useGlobalOptions: 'lines' },
    { id: 'rollerDiameter', label: 'Roller Outer Dia.', type: 'number', required: true, visible: true, isSystem: true },
    { id: 'designPattern', label: 'Design Pattern', type: 'dropdown', required: false, visible: true, isSystem: true, useGlobalOptions: 'designPatterns' },
    { id: 'rollerRa', label: 'Roller Ra', type: 'number', required: true, visible: true, isSystem: true },
    { id: 'rollerRz', label: 'Roller Rz', type: 'number', required: true, visible: true, isSystem: true },
    { id: 'remarks', label: 'Remarks', type: 'long_text', required: false, visible: true, isSystem: true },
];
