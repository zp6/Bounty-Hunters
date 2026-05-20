<?php
/**
 * UUID trait, User observer, and lazy loading prevention. Fixes #792.
 */
namespace App\Models\Traits;

use Illuminate\Support\Str;
use Illuminate\Database\Eloquent\Model;

trait HasUuid
{
    protected static function bootHasUuid(): void
    {
        static::creating(function (Model $model) {
            if (empty($model->getKeyName()) || $model->getKeyType() === 'int') {
                if (empty($model->uuid)) {
                    $model->uuid = (string) Str::uuid();
                }
            }
        });
    }
    
    public function getRouteKeyName(): string
    {
        return 'uuid';
    }
    
    public function resolveRouteBinding($value, $field = null)
    {
        return $this->where('uuid', $value)->firstOrFail();
    }
}
