<?php
/**
 * Role seeder - creates default roles idempotently.
 * Part of issue #746.
 */
namespace Database\Seeders;

use Illuminate\Database\Seeder;
use App\Models\Role;

class RoleSeeder extends Seeder
{
    /**
     * Run the database seeds. Idempotent - uses firstOrCreate.
     */
    public function run(): void
    {
        $roles = [
            ['name' => 'admin', 'description' => 'Administrator with full access'],
            ['name' => 'editor', 'description' => 'Can edit content'],
            ['name' => 'viewer', 'description' => 'Read-only access'],
        ];
        
        foreach ($roles as $role) {
            Role::firstOrCreate(
                ['name' => $role['name']],
                ['description' => $role['description']]
            );
        }
    }
}
