"""Pruebas unitarias sin hardware ni Firebase: lógica local de DB SDK ZK9500.
No sustituyen pruebas con sensor físico ni PostgreSQL.
"""
import ast
from pathlib import Path
import unittest
import logging

SOURCE=Path(__file__).resolve().parents[1] / 'enroll_gui.py'

class FakeReader:
    def __init__(self):self.db={};self.clear_count=0;self.add_count=0
    def DBClear(self):self.db.clear();self.clear_count+=1
    def DBAdd(self,slot,template):self.db[slot]=bytes(template);self.add_count+=1
    def DBDel(self,slot):self.db.pop(slot,None)


def load_local_functions(reader):
    tree=ast.parse(SOURCE.read_text(encoding='utf8'))
    names={'_rebuild_sdk','_update_one_sdk','_remove_one_sdk'}
    nodes=[n for n in tree.body if isinstance(n,ast.FunctionDef) and n.name in names]
    env={'zkfp':reader,'students_db':{},'_sensor_dirty':False,
         'logging':logging,'normalize_template':lambda raw:bytes(raw)}
    exec(compile(ast.Module(body=nodes,type_ignores=[]),str(SOURCE),'exec'),env)
    return env


class SensorLocalTests(unittest.TestCase):
    def student(self,name,template=None,status='done'):
        return {'student':{'nombre':name,'correo_tutor':'','active':True,
                'enrollmentStatus':status},'template':template}

    def test_delete_and_reenroll_same_finger(self):
        reader=FakeReader();env=load_local_functions(reader)
        entries={'a':self.student('A',b'FINGER_A'),'b':self.student('B',b'FINGER_B')}
        env['_rebuild_sdk'](entries)
        self.assertEqual(len(reader.db),2)
        self.assertEqual(len(env['students_db']),2)
        # Al borrar, PostgreSQL da template None; DBClear elimina residuos del SDK.
        entries['a']=self.student('A',None,'pending')
        env['_rebuild_sdk'](entries)
        self.assertEqual(list(reader.db.values()),[b'FINGER_B'])
        self.assertNotIn('a',{rec['studentId'] for rec in env['students_db'].values()})
        env['_update_one_sdk']('a',{'nombre':'A','correo_tutor':''},b'FINGER_A')
        self.assertEqual(set(reader.db.values()),{b'FINGER_A',b'FINGER_B'})
        self.assertEqual(len(env['students_db']),2)
        self.assertFalse(env['_sensor_dirty'])

    def test_incremental_updates_one_unchanged_finger(self):
        reader=FakeReader();env=load_local_functions(reader)
        env['_rebuild_sdk']({'a':self.student('A',b'A'),'b':self.student('B',b'B')})
        before=reader.add_count
        env['_update_one_sdk']('a',{'nombre':'A2'},b'A2')
        self.assertEqual(reader.add_count,before+1)
        self.assertEqual(list(reader.db.values()).count(b'B'),1)
        env['_remove_one_sdk']('a')
        self.assertEqual(list(reader.db.values()),[b'B'])

    def test_disabled_fingers_not_loaded(self):
        reader=FakeReader();env=load_local_functions(reader)
        env['_rebuild_sdk']({'a':self.student('A',None,'pending'),
            'b':self.student('B',b'B','removed'),'c':self.student('C',b'C')})
        self.assertEqual(list(reader.db.values()),[b'C'])


if __name__=='__main__':unittest.main()
